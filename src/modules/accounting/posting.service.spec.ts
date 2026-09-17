import { BadRequestException, ConflictException } from '@nestjs/common';
import { PostingService } from './posting.service';
import { PostEntryInput } from './posting.types';

function buildService() {
  const periodsService = {
    resolveForDate: jest.fn(),
    assertOpenForPosting: jest.fn(),
  };
  const accountsService = {
    assertActive: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  const service = new PostingService(
    dataSource as never,
    periodsService as never,
    accountsService as never,
    auditService as never,
  );

  return { service, periodsService, accountsService, auditService, dataSource };
}

function balancedInput(overrides: Partial<PostEntryInput> = {}): PostEntryInput {
  return {
    date: '2024-03-15',
    description: 'Test entry',
    sourceType: 'ManualEntry',
    createdByUserId: 'user-1',
    lines: [
      {
        accountId: 'acc-debit',
        debit: '100.00',
        credit: '0.00',
        currency: 'USD',
        exchangeRate: '1.000000',
      },
      {
        accountId: 'acc-credit',
        debit: '0.00',
        credit: '100.00',
        currency: 'USD',
        exchangeRate: '1.000000',
      },
    ],
    ...overrides,
  };
}

describe('PostingService', () => {
  describe('validateLines (via post())', () => {
    it('rejects an entry with fewer than two lines before touching the database', async () => {
      const { service, periodsService } = buildService();

      await expect(
        service.post(
          balancedInput({
            lines: [
              {
                accountId: 'a',
                debit: '10.00',
                credit: '0.00',
                currency: 'USD',
                exchangeRate: '1',
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(periodsService.resolveForDate).not.toHaveBeenCalled();
    });

    it('rejects a line that is both a debit and a credit', async () => {
      const { service } = buildService();

      await expect(
        service.post(
          balancedInput({
            lines: [
              {
                accountId: 'a',
                debit: '10.00',
                credit: '10.00',
                currency: 'USD',
                exchangeRate: '1',
              },
              {
                accountId: 'b',
                debit: '0.00',
                credit: '10.00',
                currency: 'USD',
                exchangeRate: '1',
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a negative amount', async () => {
      const { service } = buildService();

      await expect(
        service.post(
          balancedInput({
            lines: [
              {
                accountId: 'a',
                debit: '-10.00',
                credit: '0.00',
                currency: 'USD',
                exchangeRate: '1',
              },
              {
                accountId: 'b',
                debit: '0.00',
                credit: '10.00',
                currency: 'USD',
                exchangeRate: '1',
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an entry where total debit does not equal total credit', async () => {
      const { service } = buildService();

      await expect(
        service.post(
          balancedInput({
            lines: [
              {
                accountId: 'a',
                debit: '100.00',
                credit: '0.00',
                currency: 'USD',
                exchangeRate: '1',
              },
              {
                accountId: 'b',
                debit: '0.00',
                credit: '99.99',
                currency: 'USD',
                exchangeRate: '1',
              },
            ],
          }),
        ),
      ).rejects.toThrow(/not balanced/);
    });

    it('accepts many small lines that sum exactly (no floating point drift)', async () => {
      const { service, periodsService, accountsService, dataSource } = buildService();
      periodsService.resolveForDate.mockResolvedValue({ id: 'period-1' });
      periodsService.assertOpenForPosting.mockResolvedValue(undefined);
      accountsService.assertActive.mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation(async (fn: (m: unknown) => unknown) =>
        fn({
          getRepository: () => ({ create: (v: unknown) => v, save: (v: unknown) => v }),
          query: jest.fn().mockResolvedValue([{ val: '1' }]),
        }),
      );

      const lines = Array.from({ length: 3 }, (_, i) => ({
        accountId: `debit-${i}`,
        debit: '0.10',
        credit: '0.00',
        currency: 'USD',
        exchangeRate: '1',
      }));
      lines.push({
        accountId: 'credit',
        debit: '0.00',
        credit: '0.30',
        currency: 'USD',
        exchangeRate: '1',
      });

      await expect(service.post(balancedInput({ lines }))).resolves.toBeDefined();
    });
  });

  describe('period enforcement', () => {
    it('refuses to post into a period that is not open', async () => {
      const { service, periodsService } = buildService();
      periodsService.resolveForDate.mockResolvedValue({ id: 'period-1' });
      periodsService.assertOpenForPosting.mockRejectedValue(
        new ConflictException('Financial period 2024-3 is CLOSED and does not accept new postings'),
      );

      await expect(service.post(balancedInput())).rejects.toThrow(ConflictException);
    });

    it('refuses to post to an inactive account', async () => {
      const { service, periodsService, accountsService } = buildService();
      periodsService.resolveForDate.mockResolvedValue({ id: 'period-1' });
      periodsService.assertOpenForPosting.mockResolvedValue(undefined);
      accountsService.assertActive.mockRejectedValue(new ConflictException('Account is inactive'));

      await expect(service.post(balancedInput())).rejects.toThrow(ConflictException);
    });
  });
});
