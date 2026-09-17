import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('password_reset_tokens')
@Index(['userId'])
export class PasswordResetToken extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
}
