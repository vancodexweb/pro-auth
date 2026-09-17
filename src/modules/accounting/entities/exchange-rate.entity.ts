import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RATE_COLUMN } from '../../../common/constants/column-options.constant';

@Entity('exchange_rates')
@Unique(['currency', 'rateDate'])
export class ExchangeRate extends BaseEntity {
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column(RATE_COLUMN)
  rateToBase: string;

  @Column({ type: 'date' })
  rateDate: string;
}
