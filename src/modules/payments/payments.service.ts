import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentDirection } from './enums/payment-direction.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { ExpenseRequest } from '../expense-requests/entities/expense-request.entity';
import { ExpenseRequestsService } from '../expense-requests/expense-requests.service';
import { PostingService } from '../accounting/posting.service';
import { ExchangeRatesService } from '../accounting/exchange-rates.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';
import { convertWithRate } from '../../common/utils/decimal.util';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
    private readonly expenseRequestsService: ExpenseRequestsService,
    private readonly postingService: PostingService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * The idempotency contract: calling this twice with the same
   * `idempotencyKey` executes the underlying payment at most once. The key
   * is inserted as the very first statement of the transaction, so the
   * database's unique index - not application logic - is what closes the
   * race between two concurrent requests carrying the same key.
   */
  async execute(dto: CreatePaymentDto, actorId: string): Promise<Payment> {
    const existing = await this.paymentRepository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    if (!dto.expenseRequestId && !dto.counterAccountId) {
      throw new BadRequestException('counterAccountId is required unless expenseRequestId is set');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const paymentRepo = manager.getRepository(Payment);

        let counterAccountId = dto.counterAccountId;
        let expenseRequest: ExpenseRequest | null = null;
        if (dto.expenseRequestId) {
          expenseRequest = await manager
            .getRepository(ExpenseRequest)
            .findOne({ where: { id: dto.expenseRequestId } });
          if (!expenseRequest) throw new NotFoundException('Expense request not found');
          counterAccountId = expenseRequest.expenseAccountId;
        }

        // Insert first, before any other work: this is the statement whose
        // unique constraint on idempotencyKey actually prevents duplicates.
        const pendingPayment = await paymentRepo.save(
          paymentRepo.create({
            idempotencyKey: dto.idempotencyKey,
            direction: dto.direction,
            counterpartyId: dto.counterpartyId ?? null,
            contractId: dto.contractId ?? null,
            expenseRequestId: dto.expenseRequestId ?? null,
            financialDocumentId: dto.financialDocumentId ?? null,
            cashAccountId: dto.cashAccountId,
            counterAccountId: counterAccountId!,
            amount: dto.amount,
            currency: dto.currency,
            exchangeRate: '1.000000',
            baseCurrencyAmount: '0.00',
            paymentDate: dto.paymentDate,
            method: dto.method,
            status: PaymentStatus.PENDING,
            description: dto.description ?? null,
            createdByUserId: actorId,
          }),
        );

        const rate = await this.exchangeRatesService.getRate(dto.currency, dto.paymentDate);
        const baseCurrencyAmount = convertWithRate(dto.amount, rate);

        const isOutgoing = dto.direction === PaymentDirection.OUTGOING;
        const journalEntry = await this.postingService.post(
          {
            date: dto.paymentDate,
            description: dto.description ?? `Payment ${pendingPayment.id}`,
            sourceType: 'Payment',
            sourceId: pendingPayment.id,
            createdByUserId: actorId,
            lines: [
              {
                accountId: isOutgoing ? counterAccountId! : dto.cashAccountId,
                debit: dto.amount,
                credit: '0.00',
                currency: dto.currency,
                exchangeRate: rate,
                counterpartyId: dto.counterpartyId,
                contractId: dto.contractId,
              },
              {
                accountId: isOutgoing ? dto.cashAccountId : counterAccountId!,
                debit: '0.00',
                credit: dto.amount,
                currency: dto.currency,
                exchangeRate: rate,
                counterpartyId: dto.counterpartyId,
                contractId: dto.contractId,
              },
            ],
          },
          manager,
        );

        pendingPayment.status = PaymentStatus.EXECUTED;
        pendingPayment.exchangeRate = rate;
        pendingPayment.baseCurrencyAmount = baseCurrencyAmount;
        pendingPayment.journalEntryId = journalEntry.id;
        await paymentRepo.save(pendingPayment);

        if (expenseRequest) {
          await this.expenseRequestsService.markPaid(expenseRequest.id, pendingPayment.id, manager);
          await this.expenseRequestsService.markAccounted(
            expenseRequest.id,
            journalEntry.id,
            manager,
          );
        }

        await this.auditService.record(
          {
            actorUserId: actorId,
            action: AuditAction.PAYMENT_EXECUTED,
            entityType: 'Payment',
            entityId: pendingPayment.id,
            metadata: {
              idempotencyKey: dto.idempotencyKey,
              amount: dto.amount,
              currency: dto.currency,
            },
          },
          manager,
        );

        return pendingPayment;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        // Lost a race against a concurrent request with the same key - the
        // winner's row is the canonical result, not an error for this caller.
        const winner = await this.paymentRepository.findOne({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (winner) return winner;
      }
      throw error;
    }
  }

  async findAll(query: QueryPaymentsDto): Promise<PaginatedResult<Payment>> {
    const qb = this.paymentRepository.createQueryBuilder('payment');
    if (query.direction)
      qb.andWhere('payment.direction = :direction', { direction: query.direction });
    if (query.status) qb.andWhere('payment.status = :status', { status: query.status });
    if (query.counterpartyId) {
      qb.andWhere('payment.counterpartyId = :counterpartyId', {
        counterpartyId: query.counterpartyId,
      });
    }
    qb.orderBy('payment.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
