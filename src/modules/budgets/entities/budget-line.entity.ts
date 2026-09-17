import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MONEY_COLUMN } from '../../../common/constants/column-options.constant';
import { Budget } from './budget.entity';

/**
 * A department-level line (departmentId set, costCenterId null) rolls up
 * every cost center under that department when computing actuals - see
 * BudgetsService.actualForLine. A cost-center-level line is exact.
 */
@Entity('budget_lines')
export class BudgetLine extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  budgetId: string;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budgetId' })
  budget?: Budget;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  costCenterId: string | null;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @Column(MONEY_COLUMN)
  plannedAmount: string;
}
