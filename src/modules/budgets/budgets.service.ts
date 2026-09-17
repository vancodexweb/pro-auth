import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetLine } from './entities/budget-line.entity';
import { ALLOWED_BUDGET_TRANSITIONS, BudgetStatus } from './enums/budget-status.enum';
import { CreateBudgetDto, CreateBudgetLineDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetLineExecution } from './dto/budget-execution.interface';
import { AccountsService } from '../accounting/accounts.service';
import { PeriodsService } from '../accounting/periods.service';
import { AccountType, isDebitNormal } from '../accounting/enums/account-type.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';
import { subtractDecimal, toMinorUnits } from '../../common/utils/decimal.util';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Budget) private readonly budgetRepository: Repository<Budget>,
    @InjectRepository(BudgetLine) private readonly lineRepository: Repository<BudgetLine>,
    private readonly accountsService: AccountsService,
    private readonly periodsService: PeriodsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateBudgetDto, actorId: string): Promise<Budget> {
    await this.periodsService.findById(dto.periodId);

    return this.dataSource.transaction(async (manager) => {
      const budgetRepo = manager.getRepository(Budget);
      const budget = await budgetRepo.save(
        budgetRepo.create({
          name: dto.name,
          periodId: dto.periodId,
          status: BudgetStatus.DRAFT,
          createdByUserId: actorId,
        }),
      );
      await this.replaceLines(manager, budget.id, dto.lines);

      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.BUDGET_CREATED,
          entityType: 'Budget',
          entityId: budget.id,
        },
        manager,
      );

      return budget;
    });
  }

  findAll(): Promise<Budget[]> {
    return this.budgetRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Budget & { lines: BudgetLine[] }> {
    const budget = await this.budgetRepository.findOne({ where: { id } });
    if (!budget) throw new NotFoundException('Budget not found');
    const lines = await this.lineRepository.find({ where: { budgetId: id } });
    return { ...budget, lines };
  }

  async update(id: string, dto: UpdateBudgetDto): Promise<Budget> {
    return this.dataSource.transaction(async (manager) => {
      const budgetRepo = manager.getRepository(Budget);
      const budget = await budgetRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!budget) throw new NotFoundException('Budget not found');
      if (budget.status !== BudgetStatus.DRAFT) {
        throw new ConflictException('Only a DRAFT budget can be edited');
      }

      if (dto.name) budget.name = dto.name;
      if (dto.periodId) budget.periodId = dto.periodId;
      await budgetRepo.save(budget);

      if (dto.lines) {
        await this.replaceLines(manager, budget.id, dto.lines);
      }

      return budget;
    });
  }

  /** Two admins approving the same budget at once must not both succeed silently. */
  async approve(id: string, actorId: string): Promise<Budget> {
    return this.transition(id, BudgetStatus.APPROVED, async (budget, manager) => {
      budget.approvedByUserId = actorId;
      budget.approvedAt = new Date();
      await manager.getRepository(Budget).save(budget);
      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.BUDGET_APPROVED,
          entityType: 'Budget',
          entityId: id,
        },
        manager,
      );
    });
  }

  async close(id: string): Promise<Budget> {
    return this.transition(id, BudgetStatus.CLOSED, async () => undefined);
  }

  async getExecution(id: string): Promise<BudgetLineExecution[]> {
    const budget = await this.findById(id);
    const period = await this.periodsService.findById(budget.periodId);

    const results: BudgetLineExecution[] = [];
    for (const line of budget.lines) {
      const account = await this.accountsService.findById(line.accountId);
      const actual = await this.actualForLine(line, period.year, period.month, account.type);
      const deviation = subtractDecimal(actual, line.plannedAmount);
      const plannedMinor = toMinorUnits(line.plannedAmount);
      const deviationMinor = toMinorUnits(deviation);
      const deviationPercent =
        plannedMinor === 0n
          ? '0.00'
          : ((Number(deviationMinor) / Number(plannedMinor)) * 100).toFixed(2);

      results.push({
        budgetLineId: line.id,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        plannedAmount: line.plannedAmount,
        actualAmount: actual,
        deviationAmount: deviation,
        deviationPercent,
      });
    }
    return results;
  }

  private async actualForLine(
    line: BudgetLine,
    year: number,
    month: number,
    accountType: AccountType,
  ): Promise<string> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(l.debit), 0)', 'totalDebit')
      .addSelect('COALESCE(SUM(l.credit), 0)', 'totalCredit')
      .from('journal_lines', 'l')
      .innerJoin('journal_entries', 'e', 'e.id = l."journalEntryId"')
      .innerJoin('financial_periods', 'p', 'p.id = e."periodId"')
      .where('l."accountId" = :accountId', { accountId: line.accountId })
      .andWhere('p.year = :year AND p.month = :month', { year, month });

    if (line.costCenterId) {
      qb.andWhere('l."costCenterId" = :costCenterId', { costCenterId: line.costCenterId });
    } else if (line.departmentId) {
      qb.andWhere(
        'l."costCenterId" IN (SELECT id FROM cost_centers WHERE "departmentId" = :departmentId)',
        { departmentId: line.departmentId },
      );
    }
    if (line.projectId) {
      qb.andWhere('l."projectId" = :projectId', { projectId: line.projectId });
    }

    const raw = await qb.getRawOne<{ totalDebit: string; totalCredit: string }>();
    const totalDebit = raw?.totalDebit ?? '0';
    const totalCredit = raw?.totalCredit ?? '0';

    return isDebitNormal(accountType)
      ? subtractDecimal(totalDebit, totalCredit)
      : subtractDecimal(totalCredit, totalDebit);
  }

  private async transition(
    id: string,
    next: BudgetStatus,
    sideEffect: (budget: Budget, manager: EntityManager) => Promise<void>,
  ): Promise<Budget> {
    return this.dataSource.transaction(async (manager) => {
      const budgetRepo = manager.getRepository(Budget);
      const budget = await budgetRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!budget) throw new NotFoundException('Budget not found');

      const allowed = ALLOWED_BUDGET_TRANSITIONS[budget.status];
      if (!allowed.includes(next)) {
        throw new ConflictException(`Cannot transition budget from ${budget.status} to ${next}`);
      }

      budget.status = next;
      await budgetRepo.save(budget);
      await sideEffect(budget, manager);
      return budget;
    });
  }

  private async replaceLines(
    manager: EntityManager,
    budgetId: string,
    lines: CreateBudgetLineDto[],
  ): Promise<void> {
    for (const line of lines) {
      await this.accountsService.findById(line.accountId);
    }
    const lineRepo = manager.getRepository(BudgetLine);
    await lineRepo.delete({ budgetId });
    await lineRepo.save(
      lines.map((line) =>
        lineRepo.create({
          budgetId,
          accountId: line.accountId,
          departmentId: line.departmentId ?? null,
          costCenterId: line.costCenterId ?? null,
          projectId: line.projectId ?? null,
          plannedAmount: line.plannedAmount,
        }),
      ),
    );
  }
}
