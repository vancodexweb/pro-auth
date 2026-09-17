import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CounterpartyType } from '../enums/counterparty-type.enum';

@Entity('counterparties')
export class Counterparty extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  legalName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  taxId: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  registrationNumber: string | null;

  @Column({ type: 'enum', enum: CounterpartyType })
  type: CounterpartyType;

  @Column({ type: 'varchar', length: 500 })
  legalAddress: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
