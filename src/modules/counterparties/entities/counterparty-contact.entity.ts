import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Counterparty } from './counterparty.entity';

@Entity('counterparty_contacts')
export class CounterpartyContact extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  counterpartyId: string;

  @ManyToOne(() => Counterparty, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'counterpartyId' })
  counterparty?: Counterparty;

  @Column({ type: 'varchar', length: 200 })
  fullName: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  position: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;
}
