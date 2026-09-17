import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  EntityManager,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditActionType } from './audit-action.constant';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface RecordAuditEntryInput {
  actorUserId?: string | null;
  action: AuditActionType | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Writes one audit entry. Accepts an optional EntityManager so callers
   * performing a financial operation inside a transaction (e.g. posting a
   * document) can have the audit row commit or roll back atomically with
   * the business change it describes.
   */
  async record(input: RecordAuditEntryInput, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(AuditLog) : this.auditRepository;
    await repository.save(
      repository.create({
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? null,
        ipAddress: input.ipAddress ?? null,
      }),
    );
  }

  async findAll(query: QueryAuditLogDto): Promise<PaginatedResult<AuditLog>> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.action) where.action = query.action;
    if (query.from && query.to) {
      where.createdAt = Between(new Date(query.from), new Date(query.to));
    } else if (query.from) {
      where.createdAt = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      where.createdAt = LessThanOrEqual(new Date(query.to));
    }

    const [items, total] = await this.auditRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });

    return paginate(items, total, query);
  }
}
