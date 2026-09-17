import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { BudgetStatus } from '../enums/budget-status.enum';

@Entity('budgets')
export class Budget extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Index()
  @Column({ type: 'uuid' })
  periodId: string;

  @Column({ type: 'enum', enum: BudgetStatus, default: BudgetStatus.DRAFT })
  status: BudgetStatus;

  @Column({ type: 'uuid' })
  createdByUserId: string;

  @Column({ type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}
