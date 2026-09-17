import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MONEY_COLUMN } from '../../../common/constants/column-options.constant';
import { DocumentType } from '../enums/document-type.enum';
import { DocumentStatus } from '../enums/document-status.enum';

/**
 * `counterpartyId`/`contractId` are plain uuid columns (no relation): the
 * Documents module must not hard-depend on Counterparties/Contracts
 * entities. Referential integrity is still enforced by a DB foreign key
 * added in the migration.
 */
@Entity('financial_documents')
export class FinancialDocument extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  documentNumber: string;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'uuid', nullable: true })
  counterpartyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contractId: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column(MONEY_COLUMN)
  amountTotal: string;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 1000 })
  description: string;

  @Column({ type: 'uuid' })
  createdByUserId: string;

  @Column({ type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  postedJournalEntryId: string | null;

  @Column({ type: 'uuid', nullable: true })
  correctionOfDocumentId: string | null;
}
