import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Counterparty } from './counterparty.entity';

@Entity('counterparty_bank_accounts')
export class CounterpartyBankAccount extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  counterpartyId: string;

  @ManyToOne(() => Counterparty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'counterpartyId' })
  counterparty?: Counterparty;

  @Column({ type: 'varchar', length: 255 })
  bankName: string;

  @Column({ type: 'varchar', length: 50 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 20 })
  bic: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;
}
