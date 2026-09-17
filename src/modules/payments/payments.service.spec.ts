import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PaymentsService } from './payments.service';
import { PaymentDirection } from './enums/payment-direction.enum';
import { PaymentMethod, PaymentStatus } from './enums/payment-status.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';

function buildService() {
  const paymentRepository = {
    findOne: jest.fn(),
  };
  const expenseRequestsService = {
    markPaid: jest.fn(),
    markAccounted: jest.fn(),
  };
  const postingService = {
    post: jest.fn(),
  };
  const exchangeRatesService = {
    getRate: jest.fn().mockResolvedValue('1.000000'),
  };
  const auditService = {
    record: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  const service = new PaymentsService(
    dataSource as never,
    paymentRepository as never,
    expenseRequestsService as never,
    postingService as never,
    exchangeRatesService as never,
    auditService as never,
  );

  return { service, paymentRepository, expenseRequestsService, postingService, dataSource };
}

function dto(overrides: Partial<CreatePaymentDto> = {}): CreatePaymentDto {
  return {
    idempotencyKey: 'key-1',
    direction: PaymentDirection.OUTGOING,
    cashAccountId: 'cash-acc',
    counterAccountId: 'counter-acc',
    amount: '100.00',
    currency: 'USD',
    paymentDate: '2024-03-15',
    method: PaymentMethod.BANK_TRANSFER,
    ...overrides,
  };
}

describe('PaymentsService.execute (idempotency)', () => {
  it('returns the existing payment immediately when the key was already used, without re-executing', async () => {
    const { service, paymentRepository, dataSource } = buildService();
    const existing = { id: 'payment-1', idempotencyKey: 'key-1', status: PaymentStatus.EXECUTED };
    paymentRepository.findOne.mockResolvedValue(existing);

    const result = await service.execute(dto(), 'actor-1');

    expect(result).toBe(existing);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('requires counterAccountId when the payment is not linked to an expense request', async () => {
    const { service, paymentRepository } = buildService();
    paymentRepository.findOne.mockResolvedValue(null);

    await expect(service.execute(dto({ counterAccountId: undefined }), 'actor-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('on a unique-constraint race, returns the winning row instead of failing the request', async () => {
    const { service, paymentRepository, dataSource } = buildService();
    paymentRepository.findOne
      .mockResolvedValueOnce(null) // initial pre-check: no existing row
      .mockResolvedValueOnce({
        id: 'winner',
        idempotencyKey: 'key-1',
        status: PaymentStatus.EXECUTED,
      }); // post-race lookup

    const uniqueViolation = Object.assign(
      new QueryFailedError('INSERT', [], new Error('duplicate key')),
      { code: '23505' },
    );
    dataSource.transaction.mockRejectedValue(uniqueViolation);

    const result = await service.execute(dto(), 'actor-1');

    expect(result).toEqual({
      id: 'winner',
      idempotencyKey: 'key-1',
      status: PaymentStatus.EXECUTED,
    });
  });

  it('propagates a genuine failure (not a unique violation) instead of swallowing it', async () => {
    const { service, paymentRepository, dataSource } = buildService();
    paymentRepository.findOne.mockResolvedValue(null);
    dataSource.transaction.mockRejectedValue(new NotFoundException('Expense request not found'));

    await expect(service.execute(dto(), 'actor-1')).rejects.toThrow(NotFoundException);
  });
});
