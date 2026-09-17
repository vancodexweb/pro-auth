import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ExpenseRequest } from './entities/expense-request.entity';
import {
  ExpenseRequestApproval,
  ExpenseRequestApprovalAction,
} from './entities/expense-request-approval.entity';
import {
  ALLOWED_EXPENSE_REQUEST_TRANSITIONS,
  EXPENSE_REQUEST_EDITABLE_STATUSES,
  ExpenseRequestStatus,
} from './enums/expense-request-status.enum';
import { CreateExpenseRequestDto } from './dto/create-expense-request.dto';
import { UpdateExpenseRequestDto } from './dto/update-expense-request.dto';
import { QueryExpenseRequestsDto } from './dto/query-expense-requests.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';

@Injectable()
export class ExpenseRequestsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ExpenseRequest)
    private readonly requestRepository: Repository<ExpenseRequest>,
    @InjectRepository(ExpenseRequestApproval)
    private readonly approvalRepository: Repository<ExpenseRequestApproval>,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateExpenseRequestDto, actorId: string): Promise<ExpenseRequest> {
    return this.dataSource.transaction(async (manager) => {
      const requestNumber = await this.nextRequestNumber(manager);
      const repo = manager.getRepository(ExpenseRequest);
      const request = await repo.save(
        repo.create({
          requestNumber,
          requestedByUserId: actorId,
          departmentId: dto.departmentId ?? null,
          costCenterId: dto.costCenterId ?? null,
          projectId: dto.projectId ?? null,
          expenseAccountId: dto.expenseAccountId,
          amount: dto.amount,
          currency: dto.currency,
          purpose: dto.purpose,
          status: ExpenseRequestStatus.DRAFT,
        }),
      );

      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.EXPENSE_REQUEST_CREATED,
          entityType: 'ExpenseRequest',
          entityId: request.id,
        },
        manager,
      );

      return request;
    });
  }

  async findAll(query: QueryExpenseRequestsDto): Promise<PaginatedResult<ExpenseRequest>> {
    const qb = this.requestRepository.createQueryBuilder('req');
    if (query.status) qb.andWhere('req.status = :status', { status: query.status });
    if (query.requestedByUserId) {
      qb.andWhere('req.requestedByUserId = :requestedByUserId', {
        requestedByUserId: query.requestedByUserId,
      });
    }
    qb.orderBy('req.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<ExpenseRequest & { history: ExpenseRequestApproval[] }> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Expense request not found');
    const history = await this.approvalRepository.find({
      where: { expenseRequestId: id },
      order: { createdAt: 'ASC' },
    });
    return { ...request, history };
  }

  async update(id: string, dto: UpdateExpenseRequestDto, actorId: string): Promise<ExpenseRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Expense request not found');
    if (request.requestedByUserId !== actorId) {
      throw new ForbiddenException('You can only edit expense requests you created');
    }
    if (!EXPENSE_REQUEST_EDITABLE_STATUSES.includes(request.status)) {
      throw new ConflictException(`Expense request cannot be edited in status ${request.status}`);
    }

    const wasRejected = request.status === ExpenseRequestStatus.REJECTED;
    Object.assign(request, {
      departmentId: dto.departmentId ?? request.departmentId,
      costCenterId: dto.costCenterId ?? request.costCenterId,
      projectId: dto.projectId ?? request.projectId,
      expenseAccountId: dto.expenseAccountId ?? request.expenseAccountId,
      amount: dto.amount ?? request.amount,
      currency: dto.currency ?? request.currency,
      purpose: dto.purpose ?? request.purpose,
      status: wasRejected ? ExpenseRequestStatus.DRAFT : request.status,
      rejectionReason: wasRejected ? null : request.rejectionReason,
    });
    return this.requestRepository.save(request);
  }

  async submit(id: string, actorId: string): Promise<ExpenseRequest> {
    return this.transition(
      id,
      ExpenseRequestStatus.SUBMITTED,
      actorId,
      (request) => {
        if (request.requestedByUserId !== actorId) {
          throw new ForbiddenException('You can only submit expense requests you created');
        }
      },
      ExpenseRequestApprovalAction.SUBMIT,
    );
  }

  async approve(id: string, actorId: string, comment?: string): Promise<ExpenseRequest> {
    return this.transition(
      id,
      ExpenseRequestStatus.APPROVED,
      actorId,
      undefined,
      ExpenseRequestApprovalAction.APPROVE,
      comment,
    );
  }

  async reject(id: string, actorId: string, reason: string): Promise<ExpenseRequest> {
    return this.transition(
      id,
      ExpenseRequestStatus.REJECTED,
      actorId,
      async (request, manager) => {
        await manager.getRepository(ExpenseRequest).update(request.id, { rejectionReason: reason });
      },
      ExpenseRequestApprovalAction.REJECT,
      reason,
    );
  }

  async cancel(id: string, actorId: string): Promise<ExpenseRequest> {
    return this.transition(
      id,
      ExpenseRequestStatus.CANCELLED,
      actorId,
      (request) => {
        if (request.requestedByUserId !== actorId) {
          throw new ForbiddenException('You can only cancel expense requests you created');
        }
      },
      ExpenseRequestApprovalAction.CANCEL,
    );
  }

  /** Called by PaymentsService, inside its own transaction, once a payment executes. */
  async markPaid(id: string, paymentId: string, manager: EntityManager): Promise<ExpenseRequest> {
    const repo = manager.getRepository(ExpenseRequest);
    const request = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!request) throw new NotFoundException('Expense request not found');
    if (request.status !== ExpenseRequestStatus.APPROVED) {
      throw new ConflictException(
        `Expense request must be APPROVED before payment (was ${request.status})`,
      );
    }
    request.status = ExpenseRequestStatus.PAID;
    request.paymentId = paymentId;
    return repo.save(request);
  }

  /** Called by PaymentsService in the same transaction as markPaid, right after posting the ledger entry. */
  async markAccounted(
    id: string,
    journalEntryId: string,
    manager: EntityManager,
  ): Promise<ExpenseRequest> {
    const repo = manager.getRepository(ExpenseRequest);
    const request = await repo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Expense request not found');
    request.status = ExpenseRequestStatus.ACCOUNTED;
    request.journalEntryId = journalEntryId;
    return repo.save(request);
  }

  private async transition(
    id: string,
    next: ExpenseRequestStatus,
    actorId: string,
    validate:
      ((request: ExpenseRequest, manager: EntityManager) => void | Promise<void>) | undefined,
    action: ExpenseRequestApprovalAction,
    comment?: string,
  ): Promise<ExpenseRequest> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ExpenseRequest);
      const request = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!request) throw new NotFoundException('Expense request not found');

      const allowed = ALLOWED_EXPENSE_REQUEST_TRANSITIONS[request.status];
      if (!allowed.includes(next)) {
        throw new ConflictException(
          `Cannot transition expense request from ${request.status} to ${next}`,
        );
      }

      if (validate) await validate(request, manager);

      request.status = next;
      await repo.save(request);

      await manager.getRepository(ExpenseRequestApproval).save(
        manager.getRepository(ExpenseRequestApproval).create({
          expenseRequestId: id,
          actorUserId: actorId,
          action,
          comment: comment ?? null,
        }),
      );

      const auditAction =
        action === ExpenseRequestApprovalAction.APPROVE
          ? AuditAction.EXPENSE_REQUEST_APPROVED
          : action === ExpenseRequestApprovalAction.REJECT
            ? AuditAction.EXPENSE_REQUEST_REJECTED
            : action === ExpenseRequestApprovalAction.SUBMIT
              ? AuditAction.EXPENSE_REQUEST_SUBMITTED
              : AuditAction.EXPENSE_REQUEST_CREATED;

      await this.auditService.record(
        { actorUserId: actorId, action: auditAction, entityType: 'ExpenseRequest', entityId: id },
        manager,
      );

      return request;
    });
  }

  private async nextRequestNumber(manager: EntityManager): Promise<string> {
    const result = await manager.query<{ val: string }[]>(
      "SELECT nextval('expense_request_number_seq') as val",
    );
    return `ER-${result[0].val.padStart(8, '0')}`;
  }
}
