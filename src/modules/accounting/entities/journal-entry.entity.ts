import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FinancialPeriod } from './financial-period.entity';
import { JournalLine } from './journal-line.entity';
import { JournalEntryStatus } from '../enums/journal-entry-status.enum';

/**
 * A posted journal entry is immutable history. There is no UPDATE path in
 * PostingService for an existing entry's lines - the only ways to change
 * its financial effect are `reverse()` (creates a mirrored entry) or a new
 * correcting entry, both of which are new rows, never edits of this one.
 */
@Entity('journal_entries')
export class JournalEntry extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  entryNumber: string;

  @Index()
  @Column({ type: 'uuid' })
  periodId: string;

  @ManyToOne(() => FinancialPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'periodId' })
  period?: FinancialPeriod;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  /** Which module/aggregate caused this posting, e.g. "FinancialDocument", "Payment". */
  @Column({ type: 'varchar', length: 100 })
  sourceType: string;

  @Column({ type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ type: 'enum', enum: JournalEntryStatus, default: JournalEntryStatus.POSTED })
  status: JournalEntryStatus;

  @Column({ type: 'uuid' })
  createdByUserId: string;

  @Column({ type: 'uuid', nullable: true })
  reversalOfEntryId: string | null;

  @OneToMany(() => JournalLine, (line) => line.journalEntry)
  lines?: JournalLine[];
}
