import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AccountType } from '../enums/account-type.enum';

/**
 * Chart of accounts. `parentId` is a plain nullable self-reference (no
 * TypeORM relation) - the hierarchy is shallow and read via a couple of
 * explicit queries in AccountsService rather than ORM-managed tree
 * traversal, which is simpler to reason about for a chart this size.
 */
@Entity('accounts')
export class Account extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  /** Marks bank/cash GL accounts so cash-flow reporting knows which accounts to sum. */
  @Column({ type: 'boolean', default: false })
  isCash: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
