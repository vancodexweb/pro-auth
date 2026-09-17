import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MONEY_COLUMN } from '../../../common/constants/column-options.constant';
import { ExpenseRequestStatus } from '../enums/expense-request-status.enum';

@Entity('expense_requests')
export class ExpenseRequest extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  requestNumber: string;

  @Index()
  @Column({ type: 'uuid' })
  requestedByUserId: string;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  costCenterId: string | null;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  /** GL account debited when the request is paid (e.g. "Travel expenses"). */
  @Column({ type: 'uuid' })
  expenseAccountId: string;

  @Column(MONEY_COLUMN)
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 1000 })
  purpose: string;

  @Column({ type: 'enum', enum: ExpenseRequestStatus, default: ExpenseRequestStatus.DRAFT })
  status: ExpenseRequestStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  journalEntryId: string | null;
}
