import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MONEY_COLUMN } from '../../../common/constants/column-options.constant';
import { FinancialDocument } from './financial-document.entity';

/**
 * Each line names both the debit and credit GL account explicitly - the
 * preparer records the accounting treatment the same way they would on a
 * paper document, rather than the system guessing it from `type`. That
 * keeps DocumentsService free of a hardcoded chart-of-accounts ruleset,
 * which would only be correct for one specific accounting standard.
 */
@Entity('financial_document_lines')
export class FinancialDocumentLine extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  documentId: string;

  @ManyToOne(() => FinancialDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document?: FinancialDocument;

  @Column({ type: 'int' })
  lineNo: number;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column(MONEY_COLUMN)
  amount: string;

  @Column({ type: 'uuid' })
  debitAccountId: string;

  @Column({ type: 'uuid' })
  creditAccountId: string;

  @Column({ type: 'uuid', nullable: true })
  costCenterId: string | null;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;
}
