import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { MONEY_COLUMN, RATE_COLUMN } from '../../../common/constants/column-options.constant';
import { PaymentDirection } from '../enums/payment-direction.enum';
import { PaymentMethod, PaymentStatus } from '../enums/payment-status.enum';

/**
 * `idempotencyKey` is the mechanism that makes POST /payments safe to
 * retry: a unique index on this column means a second request carrying
 * the same client-generated key can never create a second row, no matter
 * how the retry races with the first attempt (see PaymentsService.execute).
 */
@Entity('payments')
export class Payment extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  idempotencyKey: string;

  @Column({ type: 'enum', enum: PaymentDirection })
  direction: PaymentDirection;

  @Column({ type: 'uuid', nullable: true })
  counterpartyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contractId: string | null;

  @Column({ type: 'uuid', nullable: true })
  expenseRequestId: string | null;

  @Column({ type: 'uuid', nullable: true })
  financialDocumentId: string | null;

  @Column({ type: 'uuid' })
  cashAccountId: string;

  @Column({ type: 'uuid' })
  counterAccountId: string;

  @Column(MONEY_COLUMN)
  amount: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column(RATE_COLUMN)
  exchangeRate: string;

  @Column(MONEY_COLUMN)
  baseCurrencyAmount: string;

  @Column({ type: 'date' })
  paymentDate: string;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  failureReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @Column({ type: 'uuid' })
  createdByUserId: string;
}
