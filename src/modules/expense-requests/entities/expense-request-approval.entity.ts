import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ExpenseRequest } from './expense-request.entity';

export enum ExpenseRequestApprovalAction {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  CANCEL = 'CANCEL',
  RESUBMIT = 'RESUBMIT',
}

/** Append-only approval history, shown alongside the request for full traceability. */
@Entity('expense_request_approvals')
export class ExpenseRequestApproval extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  expenseRequestId: string;

  @ManyToOne(() => ExpenseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expenseRequestId' })
  expenseRequest?: ExpenseRequest;

  @Column({ type: 'uuid' })
  actorUserId: string;

  @Column({ type: 'enum', enum: ExpenseRequestApprovalAction })
  action: ExpenseRequestApprovalAction;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;
}
