import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MONEY_COLUMN, RATE_COLUMN } from '../../../common/constants/column-options.constant';
import { JournalEntry } from './journal-entry.entity';
import { Account } from './account.entity';

/**
 * A single debit or credit. `debit`/`credit` are mutually exclusive per
 * line (enforced by a CHECK constraint in the migration, not just here) -
 * this is what SUM(debit) = SUM(credit) per journal entry is computed
 * over. Amounts are also carried in base currency so cross-currency
 * reports never need to reconvert historical postings with today's rate.
 */
@Entity('journal_lines')
export class JournalLine extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journalEntryId' })
  journalEntry?: JournalEntry;

  @Column({ type: 'int' })
  lineNo: number;

  @Index()
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountId' })
  account?: Account;

  @Column(MONEY_COLUMN)
  debit: string;

  @Column(MONEY_COLUMN)
  credit: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column(RATE_COLUMN)
  exchangeRate: string;

  @Column(MONEY_COLUMN)
  baseCurrencyDebit: string;

  @Column(MONEY_COLUMN)
  baseCurrencyCredit: string;

  @Column({ type: 'uuid', nullable: true })
  counterpartyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contractId: string | null;

  @Column({ type: 'uuid', nullable: true })
  costCenterId: string | null;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;
}
