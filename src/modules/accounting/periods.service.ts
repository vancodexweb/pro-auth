import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FinancialPeriod } from './entities/financial-period.entity';
import { ALLOWED_PERIOD_TRANSITIONS, PeriodStatus } from './enums/period-status.enum';
import { CreatePeriodDto } from './dto/create-period.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';

@Injectable()
export class PeriodsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(FinancialPeriod)
    private readonly periodRepository: Repository<FinancialPeriod>,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePeriodDto): Promise<FinancialPeriod> {
    const existing = await this.periodRepository.findOne({
      where: { year: dto.year, month: dto.month },
    });
    if (existing) {
      throw new ConflictException(`Period ${dto.year}-${dto.month} already exists`);
    }
    return this.periodRepository.save(
      this.periodRepository.create({ year: dto.year, month: dto.month, status: PeriodStatus.OPEN }),
    );
  }

  findAll(): Promise<FinancialPeriod[]> {
    return this.periodRepository.find({ order: { year: 'DESC', month: 'DESC' } });
  }

  async findById(id: string): Promise<FinancialPeriod> {
    const period = await this.periodRepository.findOne({ where: { id } });
    if (!period) throw new NotFoundException('Financial period not found');
    return period;
  }

  /** Resolves the period a given calendar date belongs to. Periods are never auto-created. */
  async resolveForDate(date: string): Promise<FinancialPeriod> {
    const [year, month] = date.split('-').map((part) => parseInt(part, 10));
    const period = await this.periodRepository.findOne({ where: { year, month } });
    if (!period) {
      throw new ConflictException(
        `No financial period exists for ${year}-${String(month).padStart(2, '0')}. Ask an administrator to create it.`,
      );
    }
    return period;
  }

  async assertOpenForPosting(periodId: string): Promise<void> {
    const period = await this.findById(periodId);
    if (period.status !== PeriodStatus.OPEN) {
      throw new ConflictException(
        `Financial period ${period.year}-${period.month} is ${period.status} and does not accept new postings`,
      );
    }
  }

  async transition(id: string, actorId: string, next: PeriodStatus): Promise<FinancialPeriod> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FinancialPeriod);
      const period = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!period) throw new NotFoundException('Financial period not found');

      const allowed = ALLOWED_PERIOD_TRANSITIONS[period.status];
      if (!allowed.includes(next)) {
        throw new ConflictException(`Cannot transition period from ${period.status} to ${next}`);
      }

      period.status = next;
      if (next === PeriodStatus.CLOSED) {
        period.closedAt = new Date();
        period.closedByUserId = actorId;
      }
      await repo.save(period);

      await this.auditService.record(
        {
          actorUserId: actorId,
          action:
            next === PeriodStatus.CLOSED
              ? AuditAction.PERIOD_CLOSED
              : next === PeriodStatus.CLOSING
                ? AuditAction.PERIOD_CLOSING_STARTED
                : AuditAction.PERIOD_OPENED,
          entityType: 'FinancialPeriod',
          entityId: period.id,
          metadata: { year: period.year, month: period.month, status: period.status },
        },
        manager,
      );

      return period;
    });
  }

  /**
   * Deliberately outside the normal transition table: reopening a CLOSED
   * period is a rare, high-impact override (e.g. a material error found
   * after close) and must never be reachable through the generic
   * transition endpoint. Every call is heavily audited.
   */
  async reopenClosedPeriod(id: string, actorId: string, reason: string): Promise<FinancialPeriod> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FinancialPeriod);
      const period = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!period) throw new NotFoundException('Financial period not found');
      if (period.status !== PeriodStatus.CLOSED) {
        throw new ConflictException('Only a CLOSED period can be reopened');
      }

      period.status = PeriodStatus.OPEN;
      period.closedAt = null;
      period.closedByUserId = null;
      await repo.save(period);

      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.PERIOD_OPENED,
          entityType: 'FinancialPeriod',
          entityId: period.id,
          metadata: { year: period.year, month: period.month, reopenedFromClosed: true, reason },
        },
        manager,
      );

      return period;
    });
  }
}
