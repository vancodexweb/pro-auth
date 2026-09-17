import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { RoleEntity } from '../auth/entities/role.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { UserStatus } from '../auth/enums/user-status.enum';
import { QueryUsersDto } from './dto/query-users.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { PeopleService } from '../people/people.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RoleEntity) private readonly roleRepository: Repository<RoleEntity>,
    private readonly peopleService: PeopleService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<User>> {
    const qb = this.userRepository.createQueryBuilder('user');
    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    qb.orderBy('user.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Approve is the classic "two admins click approve at the same time"
   * race from the spec. A pessimistic write lock on the user row inside a
   * transaction means the second transaction blocks until the first
   * commits, then re-reads a status that is no longer PENDING_ADMIN_APPROVAL
   * and fails cleanly instead of double-approving / double-creating the
   * employee record.
   */
  async approve(userId: string, adminId: string, dto: ApproveUserDto): Promise<User> {
    const user = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
        // Postgres refuses FOR UPDATE on a query that outer-joins User's
        // eager `role` relation ("FOR UPDATE cannot be applied to the
        // nullable side of an outer join"); the lock only needs this row.
        loadEagerRelations: false,
      });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.PENDING_ADMIN_APPROVAL) {
        throw new ConflictException(`User cannot be approved from status ${user.status}`);
      }

      user.status = UserStatus.ACTIVE;
      user.approvedAt = new Date();
      user.approvedByUserId = adminId;
      await userRepo.save(user);

      await this.peopleService.createEmployee(
        userId,
        { departmentId: dto.departmentId, position: dto.position, hireDate: dto.hireDate },
        manager,
      );

      await this.auditService.record(
        {
          actorUserId: adminId,
          action: AuditAction.USER_APPROVED,
          entityType: 'User',
          entityId: userId,
        },
        manager,
      );

      return user;
    });

    // Sent only after the transaction above has committed - see the
    // comment on AuthService.issueVerificationCode for why mail (external
    // network I/O) can never run while a transaction is still open: a
    // slow/unreachable SMTP server can hang past
    // idle_in_transaction_session_timeout, which kills the connection and
    // makes the subsequent COMMIT fail with TypeORM's
    // "QueryRunnerAlreadyReleasedError" instead of the real SMTP error -
    // silently losing the approval that had already been written.
    await this.mailService.sendAccountApproved(user.email);
    return user;
  }

  async reject(userId: string, adminId: string, reason: string): Promise<User> {
    const user = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
        // Postgres refuses FOR UPDATE on a query that outer-joins User's
        // eager `role` relation ("FOR UPDATE cannot be applied to the
        // nullable side of an outer join"); the lock only needs this row.
        loadEagerRelations: false,
      });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.PENDING_ADMIN_APPROVAL) {
        throw new ConflictException(`User cannot be rejected from status ${user.status}`);
      }

      user.status = UserStatus.REJECTED;
      user.rejectedAt = new Date();
      user.rejectionReason = reason;
      await userRepo.save(user);

      await this.auditService.record(
        {
          actorUserId: adminId,
          action: AuditAction.USER_REJECTED,
          entityType: 'User',
          entityId: userId,
          metadata: { reason },
        },
        manager,
      );

      return user;
    });

    // Sent only after the transaction above has committed - see the
    // comment on `approve()` for why.
    await this.mailService.sendAccountRejected(user.email, reason);
    return user;
  }

  async block(userId: string, adminId: string, reason: string): Promise<User> {
    const user = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
        // Postgres refuses FOR UPDATE on a query that outer-joins User's
        // eager `role` relation ("FOR UPDATE cannot be applied to the
        // nullable side of an outer join"); the lock only needs this row.
        loadEagerRelations: false,
      });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.ACTIVE) {
        throw new ConflictException(`Only active users can be blocked (current: ${user.status})`);
      }

      user.status = UserStatus.BLOCKED;
      user.blockedAt = new Date();
      user.blockedReason = reason;
      await userRepo.save(user);

      await manager
        .getRepository(RefreshToken)
        .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });

      await this.auditService.record(
        {
          actorUserId: adminId,
          action: AuditAction.USER_BLOCKED,
          entityType: 'User',
          entityId: userId,
          metadata: { reason },
        },
        manager,
      );

      return user;
    });

    // Sent only after the transaction above has committed - see the
    // comment on `approve()` for why.
    await this.mailService.sendAccountBlocked(user.email, reason);
    return user;
  }

  async unblock(userId: string, adminId: string): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
        // Postgres refuses FOR UPDATE on a query that outer-joins User's
        // eager `role` relation ("FOR UPDATE cannot be applied to the
        // nullable side of an outer join"); the lock only needs this row.
        loadEagerRelations: false,
      });
      if (!user) throw new NotFoundException('User not found');
      if (user.status !== UserStatus.BLOCKED) {
        throw new ConflictException(
          `Only blocked users can be unblocked (current: ${user.status})`,
        );
      }

      user.status = UserStatus.ACTIVE;
      user.blockedAt = null;
      user.blockedReason = null;
      await userRepo.save(user);

      await this.auditService.record(
        {
          actorUserId: adminId,
          action: AuditAction.USER_UNBLOCKED,
          entityType: 'User',
          entityId: userId,
        },
        manager,
      );

      return user;
    });
  }

  async changeRole(userId: string, adminId: string, roleName: string): Promise<User> {
    const role = await this.roleRepository.findOne({ where: { name: roleName } });
    if (!role) throw new NotFoundException(`Role "${roleName}" does not exist`);

    const user = await this.findById(userId);
    const previousRole = user.roleId;
    user.roleId = role.id;
    await this.userRepository.save(user);

    await this.auditService.record({
      actorUserId: adminId,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: 'User',
      entityId: userId,
      metadata: { previousRoleId: previousRole, newRoleId: role.id, newRoleName: role.name },
    });

    return this.findById(userId);
  }
}
