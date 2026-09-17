import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { JournalEntryStatus } from './enums/journal-entry-status.enum';
import { PeriodsService } from './periods.service';
import { AccountsService } from './accounts.service';
import { PostEntryInput, PostingLineInput } from './posting.types';
import { convertWithRate, sumMinorUnits, toMinorUnits } from '../../common/utils/decimal.util';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';

/**
 * The only place in the codebase allowed to write to journal_entries /
 * journal_lines. Every other module (documents, payments, ...) creates
 * ledger effects by calling `post()` here, never by touching the
 * repositories directly - that is what keeps SUM(DEBIT) = SUM(CREDIT)
 * true for every single entry without every caller having to remember it.
 *
 * A Postgres trigger (see migration 0005) re-checks the same invariant at
 * the database level as a last line of defense.
 */
@Injectable()
export class PostingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly periodsService: PeriodsService,
    private readonly accountsService: AccountsService,
    private readonly auditService: AuditService,
  ) {}

  async post(input: PostEntryInput, manager?: EntityManager): Promise<JournalEntry> {
    this.validateLines(input.lines);

    const period = await this.periodsService.resolveForDate(input.date);
    await this.periodsService.assertOpenForPosting(period.id);

    for (const line of input.lines) {
      await this.accountsService.assertActive(line.accountId);
    }

    const run = async (txManager: EntityManager): Promise<JournalEntry> => {
      const entryNumber = await this.nextEntryNumber(txManager);
      const entryRepo = txManager.getRepository(JournalEntry);
      const lineRepo = txManager.getRepository(JournalLine);

      const entry = await entryRepo.save(
        entryRepo.create({
          entryNumber,
          periodId: period.id,
          date: input.date,
          description: input.description,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          status: JournalEntryStatus.POSTED,
          createdByUserId: input.createdByUserId,
        }),
      );

      const lines = input.lines.map((line, index) =>
        lineRepo.create({
          journalEntryId: entry.id,
          lineNo: index + 1,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          currency: line.currency,
          exchangeRate: line.exchangeRate,
          baseCurrencyDebit: this.toBaseCurrency(line.debit, line.exchangeRate),
          baseCurrencyCredit: this.toBaseCurrency(line.credit, line.exchangeRate),
          counterpartyId: line.counterpartyId ?? null,
          contractId: line.contractId ?? null,
          costCenterId: line.costCenterId ?? null,
          projectId: line.projectId ?? null,
          description: line.description ?? null,
        }),
      );
      await lineRepo.save(lines);

      await this.auditService.record(
        {
          actorUserId: input.createdByUserId,
          action: AuditAction.DOCUMENT_POSTED,
          entityType: 'JournalEntry',
          entityId: entry.id,
          metadata: { entryNumber, sourceType: input.sourceType, sourceId: input.sourceId },
        },
        txManager,
      );

      entry.lines = lines;
      return entry;
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  /**
   * Creates a new entry with every debit/credit swapped from the original,
   * dated in a currently open period, and marks the original REVERSED.
   * Nothing about the original row is ever mutated.
   */
  async reverse(
    original: JournalEntry & { lines: JournalLine[] },
    actorUserId: string,
    reversalDate: string,
    manager?: EntityManager,
  ): Promise<JournalEntry> {
    if (original.status !== JournalEntryStatus.POSTED) {
      throw new ConflictException('Only a POSTED journal entry can be reversed');
    }

    const reversalLines: PostingLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
      currency: line.currency,
      exchangeRate: line.exchangeRate,
      counterpartyId: line.counterpartyId,
      contractId: line.contractId,
      costCenterId: line.costCenterId,
      projectId: line.projectId,
      description: `Reversal of ${original.entryNumber}`,
    }));

    const run = async (txManager: EntityManager): Promise<JournalEntry> => {
      const reversalEntry = await this.post(
        {
          date: reversalDate,
          description: `Reversal of ${original.entryNumber}: ${original.description}`,
          sourceType: original.sourceType,
          sourceId: original.sourceId,
          createdByUserId: actorUserId,
          lines: reversalLines,
        },
        txManager,
      );

      await txManager
        .getRepository(JournalEntry)
        .update(original.id, { status: JournalEntryStatus.REVERSED });

      await this.auditService.record(
        {
          actorUserId,
          action: AuditAction.DOCUMENT_REVERSED,
          entityType: 'JournalEntry',
          entityId: original.id,
          metadata: { reversalEntryId: reversalEntry.id },
        },
        txManager,
      );

      return reversalEntry;
    };

    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  private validateLines(lines: PostingLineInput[]): void {
    if (lines.length < 2) {
      throw new BadRequestException('A journal entry needs at least two lines');
    }

    for (const line of lines) {
      const debit = toMinorUnits(line.debit);
      const credit = toMinorUnits(line.credit);
      if (debit < 0n || credit < 0n) {
        throw new BadRequestException('debit and credit amounts cannot be negative');
      }
      if (debit > 0n && credit > 0n) {
        throw new BadRequestException('A line cannot be both a debit and a credit');
      }
      if (debit === 0n && credit === 0n) {
        throw new BadRequestException('A line must have a non-zero debit or credit');
      }
    }

    const totalDebit = sumMinorUnits(lines.map((l) => l.debit));
    const totalCredit = sumMinorUnits(lines.map((l) => l.credit));
    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Journal entry is not balanced: total debit ${totalDebit} != total credit ${totalCredit}`,
      );
    }
  }

  private toBaseCurrency(amount: string, rate: string): string {
    return convertWithRate(amount, rate);
  }

  private async nextEntryNumber(manager: EntityManager): Promise<string> {
    const result = await manager.query<{ val: string }[]>(
      "SELECT nextval('journal_entry_number_seq') as val",
    );
    return `JE-${result[0].val.padStart(8, '0')}`;
  }
}
