import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { User } from './entities/user.entity';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Permission } from '../../common/constants/permissions.constant';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(user: User): { token: string; expiresIn: string } {
    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions.map((p) => p.code as Permission),
    };
    const expiresIn = this.configService.get<string>('jwt.accessExpiresIn')!;
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn,
    });
    return { token, expiresIn };
  }

  generateOpaqueToken(): { raw: string; hash: string } {
    const raw = randomBytes(48).toString('hex');
    return { raw, hash: this.hash(raw) };
  }

  generateNumericCode(length = 6): string {
    const max = 10 ** length;
    const value = randomInt(0, max);
    return value.toString().padStart(length, '0');
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  refreshTokenTtlMs(): number {
    return this.parseDurationToMs(this.configService.get<string>('jwt.refreshExpiresIn')!);
  }

  private parseDurationToMs(duration: string): number {
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
    if (!match) {
      throw new Error(`Invalid duration format: "${duration}"`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * multipliers[unit];
  }
}
