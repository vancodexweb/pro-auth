import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PeriodStatus } from '../enums/period-status.enum';

@Entity('financial_periods')
@Unique(['year', 'month'])
export class FinancialPeriod extends BaseEntity {
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'enum', enum: PeriodStatus, default: PeriodStatus.OPEN })
  status: PeriodStatus;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  closedByUserId: string | null;
}
