import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MONEY_COLUMN } from '../../../common/constants/column-options.constant';
import { Counterparty } from '../../counterparties/entities/counterparty.entity';
import { ContractStatus } from '../enums/contract-status.enum';

@Entity('contracts')
export class Contract extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  number: string;

  @Index()
  @Column({ type: 'uuid' })
  counterpartyId: string;

  @ManyToOne(() => Counterparty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'counterpartyId' })
  counterparty?: Counterparty;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'enum', enum: ContractStatus, default: ContractStatus.DRAFT })
  status: ContractStatus;

  @Column(MONEY_COLUMN)
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;
}
