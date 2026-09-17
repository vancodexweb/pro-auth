import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Refresh tokens are opaque random strings, never JWTs: revocation is then
 * a plain DB update instead of needing a blacklist. Only the sha256 hash
 * is stored, so a leaked database dump can't be replayed as a session.
 * `familyId` links every token produced by one rotation chain so that
 * reuse of an already-rotated token can revoke the whole chain (theft
 * detection) instead of just the one token.
 */
@Entity('refresh_tokens')
@Index(['userId'])
export class RefreshToken extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'uuid' })
  familyId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'char', length: 64, nullable: true })
  replacedByTokenHash: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;
}
