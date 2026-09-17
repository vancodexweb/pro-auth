import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { User } from './entities/user.entity';
import { RoleEntity } from './entities/role.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { UserStatus } from './enums/user-status.enum';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailOnlyDto } from './dto/email-only.dto';
import { RegisteredFiles } from './dto/registered-files.interface';
import { TokenService } from './token.service';
import { PeopleService } from '../people/people.service';
import { FilesService } from '../files/files.service';
import { FileCategory } from '../files/file-category.enum';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';
import { ROLE_WORKER } from '../../common/constants/permissions.constant';
import { comparePassword, hashPassword } from '../../common/utils/password.util';

const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RoleEntity) private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(EmailVerificationToken)
    private readonly verificationRepository: Repository<EmailVerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepository: Repository<PasswordResetToken>,
    private readonly tokenService: TokenService,
    private readonly peopleService: PeopleService,
    private readonly filesService: FilesService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async register(
    dto: RegisterDto,
    files: RegisteredFiles,
    ctx: RequestContext,
  ): Promise<{ userId: string; email: string }> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const mainPhoto = files.passportMainPhoto?.[0];
    const registrationPhoto = files.passportRegistrationPhoto?.[0];
    const facePhoto = files.facePhoto?.[0];
    if (!mainPhoto || !registrationPhoto || !facePhoto) {
      throw new BadRequestException(
        'passportMainPhoto, passportRegistrationPhoto and facePhoto are all required',
      );
    }

    const workerRole = await this.roleRepository.findOne({ where: { name: ROLE_WORKER } });
    if (!workerRole) {
      throw new Error(`Role "${ROLE_WORKER}" is not seeded - run database migrations`);
    }

    const passwordHash = await hashPassword(dto.password);

    const userId = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      let user: User;
      try {
        user = await userRepo.save(
          userRepo.create({
            email,
            passwordHash,
            status: UserStatus.PENDING_EMAIL_VERIFICATION,
            roleId: workerRole.id,
          }),
        );
      } catch (error) {
        // Defense in depth against the race where two identical registrations
        // land concurrently; the unique index on `email` is the real guard.
        throw new ConflictException('An account with this email already exists');
      }

      const [mainPhotoFile, registrationPhotoFile, facePhotoFile] = await Promise.all([
        this.filesService.store(
          {
            ownerUserId: user.id,
            category: FileCategory.PASSPORT_MAIN_PAGE,
            buffer: mainPhoto.buffer,
            originalName: mainPhoto.originalname,
            mimeType: mainPhoto.mimetype,
          },
          manager,
        ),
        this.filesService.store(
          {
            ownerUserId: user.id,
            category: FileCategory.PASSPORT_REGISTRATION_PAGE,
            buffer: registrationPhoto.buffer,
            originalName: registrationPhoto.originalname,
            mimeType: registrationPhoto.mimetype,
          },
          manager,
        ),
        this.filesService.store(
          {
            ownerUserId: user.id,
            category: FileCategory.FACE_PHOTO,
            buffer: facePhoto.buffer,
            originalName: facePhoto.originalname,
            mimeType: facePhoto.mimetype,
          },
          manager,
        ),
      ]);

      await this.peopleService.createProfile(
        {
          userId: user.id,
          lastName: dto.lastName,
          firstName: dto.firstName,
          middleName: dto.middleName,
          birthDate: dto.birthDate,
          gender: dto.gender,
          birthPlace: dto.birthPlace,
          countryOfResidence: dto.countryOfResidence,
          countryOfRegistration: dto.countryOfRegistration,
          cityOfRegistration: dto.cityOfRegistration,
          street: dto.street,
          registrationDate: dto.registrationDate,
          facePhotoFileId: facePhotoFile.id,
          passport: {
            issuedBy: dto.passportIssuedBy,
            issueDate: dto.passportIssueDate,
            subdivisionCode: dto.passportSubdivisionCode,
            mainPagePhotoFileId: mainPhotoFile.id,
            registrationPagePhotoFileId: registrationPhotoFile.id,
          },
        },
        manager,
      );

      await this.issueVerificationCode(user, manager);

      await this.auditService.record(
        {
          actorUserId: user.id,
          action: AuditAction.USER_REGISTERED,
          entityType: 'User',
          entityId: user.id,
          ipAddress: ctx.ipAddress,
        },
        manager,
      );

      return user.id;
    });

    return { userId, email };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({ where: { email } });
    const genericError = new BadRequestException('Invalid or expired verification code');

    if (!user) throw genericError;
    if (user.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
      throw new ConflictException('Email is already verified');
    }

    const token = await this.verificationRepository.findOne({
      where: { userId: user.id, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!token) throw genericError;
    if (token.expiresAt.getTime() < Date.now()) throw genericError;
    if (token.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new ForbiddenException('Too many attempts - please request a new code');
    }

    const codeHash = this.tokenService.hash(dto.code);
    if (codeHash !== token.codeHash) {
      await this.verificationRepository.increment({ id: token.id }, 'attempts', 1);
      throw genericError;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(EmailVerificationToken, token.id, { consumedAt: new Date() });
      await manager.update(User, user.id, {
        emailVerifiedAt: new Date(),
        status: UserStatus.PENDING_ADMIN_APPROVAL,
      });
      await this.auditService.record(
        {
          actorUserId: user.id,
          action: AuditAction.EMAIL_VERIFIED,
          entityType: 'User',
          entityId: user.id,
        },
        manager,
      );
    });

    return { message: 'Email verified. Your account is now awaiting administrator approval.' };
  }

  async resendVerification(dto: EmailOnlyDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('No pending registration found for this email');
    }
    if (user.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
      throw new ConflictException('Email is already verified');
    }

    const lastToken = await this.verificationRepository.findOne({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    if (lastToken && Date.now() - lastToken.createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS) {
      throw new HttpException(
        'Please wait before requesting another verification code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.issueVerificationCode(user);
    return { message: 'A new verification code has been sent to your email.' };
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<TokenPairResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        roleId: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    const invalidCredentials = new UnauthorizedException('Invalid email or password');
    if (!user) throw invalidCredentials;

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        'Account temporarily locked due to repeated failed login attempts. Try again later.',
      );
    }

    const passwordValid = await comparePassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.registerFailedLogin(user, ctx);
      throw invalidCredentials;
    }

    this.assertLoginAllowedByStatus(user.status);

    // Reload with the role + permissions relation for the token payload
    // (excluded above via `select` to keep the passwordHash query minimal).
    const fullUser = await this.userRepository.findOneOrFail({ where: { id: user.id } });

    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    const tokens = await this.issueTokenPair(fullUser, ctx);

    await this.auditService.record({
      actorUserId: user.id,
      action: AuditAction.USER_LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });

    return tokens;
  }

  async refresh(dto: RefreshTokenDto, ctx: RequestContext): Promise<TokenPairResponse> {
    const tokenHash = this.tokenService.hash(dto.refreshToken);
    const existing = await this.refreshTokenRepository.findOne({ where: { tokenHash } });
    const invalid = new UnauthorizedException('Invalid refresh token');

    if (!existing) throw invalid;

    if (existing.revokedAt) {
      // A previously-rotated (revoked) token was presented again: possible
      // theft. Nuke the whole rotation family so both the attacker's and
      // the legitimate holder's session are forced to re-authenticate.
      await this.refreshTokenRepository.update(
        { familyId: existing.familyId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Refresh token reuse detected - please log in again');
    }

    if (existing.expiresAt.getTime() < Date.now()) throw invalid;

    const user = await this.userRepository.findOne({ where: { id: existing.userId } });
    if (!user) throw invalid;
    this.assertLoginAllowedByStatus(user.status);

    const tokens = await this.dataSource.transaction(async (manager) => {
      const refreshRepo = manager.getRepository(RefreshToken);
      const newToken = this.tokenService.generateOpaqueToken();

      await refreshRepo.update(existing.id, {
        revokedAt: new Date(),
        replacedByTokenHash: newToken.hash,
      });

      await refreshRepo.save(
        refreshRepo.create({
          userId: user.id,
          tokenHash: newToken.hash,
          familyId: existing.familyId,
          expiresAt: new Date(Date.now() + this.tokenService.refreshTokenTtlMs()),
          userAgent: ctx.userAgent,
          ipAddress: ctx.ipAddress,
        }),
      );

      const { token: accessToken, expiresIn } = this.tokenService.signAccessToken(user);
      return {
        accessToken,
        refreshToken: newToken.raw,
        tokenType: 'Bearer' as const,
        expiresIn,
      };
    });

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hash(refreshToken);
    await this.refreshTokenRepository.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException();

    const valid = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const newHash = await hashPassword(dto.newPassword);
    await this.userRepository.update(userId, { passwordHash: newHash });
    await this.logoutAll(userId);

    await this.auditService.record({
      actorUserId: userId,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: userId,
    });
  }

  async forgotPassword(dto: EmailOnlyDto): Promise<{ message: string }> {
    const genericMessage = {
      message: 'If an account with this email exists, a reset code has been sent.',
    };
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || user.status === UserStatus.REJECTED) {
      return genericMessage;
    }

    const lastToken = await this.resetRepository.findOne({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    if (lastToken && Date.now() - lastToken.createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS) {
      return genericMessage;
    }

    const { raw, hash } = this.tokenService.generateOpaqueToken();
    await this.resetRepository.save(
      this.resetRepository.create({
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      }),
    );
    await this.mailService.sendPasswordResetToken(user.email, raw);
    await this.auditService.record({
      actorUserId: user.id,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: 'User',
      entityId: user.id,
    });

    return genericMessage;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({ where: { email } });
    const invalidToken = new BadRequestException('Invalid or expired reset token');
    if (!user) throw invalidToken;

    const tokenHash = this.tokenService.hash(dto.token);
    const token = await this.resetRepository.findOne({
      where: { userId: user.id, tokenHash, consumedAt: IsNull() },
    });
    if (!token || token.expiresAt.getTime() < Date.now()) throw invalidToken;

    const newHash = await hashPassword(dto.newPassword);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(PasswordResetToken, token.id, { consumedAt: new Date() });
      await manager.update(User, user.id, { passwordHash: newHash });
      await manager.update(
        RefreshToken,
        { userId: user.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      await this.auditService.record(
        {
          actorUserId: user.id,
          action: AuditAction.PASSWORD_RESET_COMPLETED,
          entityType: 'User',
          entityId: user.id,
        },
        manager,
      );
    });
  }

  private assertLoginAllowedByStatus(status: UserStatus): void {
    switch (status) {
      case UserStatus.PENDING_EMAIL_VERIFICATION:
        throw new ForbiddenException('Please verify your email address before logging in');
      case UserStatus.PENDING_ADMIN_APPROVAL:
        throw new ForbiddenException('Your account is awaiting administrator approval');
      case UserStatus.BLOCKED:
        throw new ForbiddenException('Your account has been blocked');
      case UserStatus.REJECTED:
        throw new ForbiddenException('Your registration was rejected');
      case UserStatus.ACTIVE:
        return;
    }
  }

  private async registerFailedLogin(user: User, ctx: RequestContext): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_LOCK_MS) : null;
    await this.userRepository.update(user.id, {
      failedLoginAttempts: lockedUntil ? 0 : attempts,
      lockedUntil,
    });
    await this.auditService.record({
      actorUserId: user.id,
      action: AuditAction.USER_LOGIN_FAILED,
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });
  }

  private async issueVerificationCode(
    user: User,
    manager = this.dataSource.manager,
  ): Promise<void> {
    const repo = manager.getRepository(EmailVerificationToken);
    await repo.update({ userId: user.id, consumedAt: IsNull() }, { consumedAt: new Date() });

    const code = this.tokenService.generateNumericCode(6);
    await repo.save(
      repo.create({
        userId: user.id,
        codeHash: this.tokenService.hash(code),
        expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
      }),
    );
    await this.mailService.sendVerificationCode(user.email, code);
  }

  private async issueTokenPair(user: User, ctx: RequestContext): Promise<TokenPairResponse> {
    const familyId = randomUUID();
    const { raw, hash } = this.tokenService.generateOpaqueToken();

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
        tokenHash: hash,
        familyId,
        expiresAt: new Date(Date.now() + this.tokenService.refreshTokenTtlMs()),
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
      }),
    );

    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken(user);
    return { accessToken, refreshToken: raw, tokenType: 'Bearer', expiresIn };
  }
}
