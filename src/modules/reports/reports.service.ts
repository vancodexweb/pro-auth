import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportHistory } from './entities/report-history.entity';
import { ReportFormat, ReportStatus, ReportType } from './enums/report-type.enum';
import { CreateReportDto } from './dto/create-report.dto';
import { QueryReportHistoryDto } from './dto/query-report-history.dto';
import { XlsxReportGenerator } from './generators/xlsx.generator';
import { PdfReportGenerator } from './generators/pdf.generator';
import { DocxReportGenerator } from './generators/docx.generator';
import { ReportJobQueue } from './report-job-queue';
import { ReportGenerator, ReportPayload, ReportTable } from './report-payload.types';
import { AnalyticsService } from '../analytics/analytics.service';
import { FilesService } from '../files/files.service';
import { FileCategory } from '../files/file-category.enum';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';

@Injectable()
export class ReportsService {
  private readonly generators: Record<ReportFormat, ReportGenerator>;

  constructor(
    @InjectRepository(ReportHistory)
    private readonly reportHistoryRepository: Repository<ReportHistory>,
    private readonly analyticsService: AnalyticsService,
    private readonly filesService: FilesService,
    private readonly auditService: AuditService,
    private readonly jobQueue: ReportJobQueue,
    xlsxGenerator: XlsxReportGenerator,
    pdfGenerator: PdfReportGenerator,
    docxGenerator: DocxReportGenerator,
  ) {
    this.generators = {
      [ReportFormat.XLSX]: xlsxGenerator,
      [ReportFormat.PDF]: pdfGenerator,
      [ReportFormat.DOCX]: docxGenerator,
    };
  }

  /**
   * Returns immediately with a PENDING record; the actual query + document
   * generation happens off the request thread via ReportJobQueue, so a
   * heavy report never holds an HTTP connection open. Poll GET
   * /reports/:id (or download once status is COMPLETED).
   */
  async requestReport(
    dto: CreateReportDto,
    actorId: string,
    actorEmail: string,
  ): Promise<ReportHistory> {
    const history = await this.reportHistoryRepository.save(
      this.reportHistoryRepository.create({
        requestedByUserId: actorId,
        reportType: dto.reportType,
        format: dto.format,
        parameters: { counterpartyId: dto.counterpartyId ?? null },
        periodFrom: dto.from,
        periodTo: dto.to,
        status: ReportStatus.PENDING,
      }),
    );

    this.jobQueue.enqueue(() => this.runJob(history.id, dto, actorId, actorEmail));

    return history;
  }

  async findAll(query: QueryReportHistoryDto): Promise<PaginatedResult<ReportHistory>> {
    const qb = this.reportHistoryRepository.createQueryBuilder('r');
    if (query.reportType)
      qb.andWhere('r.reportType = :reportType', { reportType: query.reportType });
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.requestedByUserId) {
      qb.andWhere('r.requestedByUserId = :requestedByUserId', {
        requestedByUserId: query.requestedByUserId,
      });
    }
    qb.orderBy('r.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<ReportHistory> {
    const history = await this.reportHistoryRepository.findOne({ where: { id } });
    if (!history) throw new NotFoundException('Report not found');
    return history;
  }

  private async runJob(
    historyId: string,
    dto: CreateReportDto,
    actorId: string,
    actorEmail: string,
  ): Promise<void> {
    await this.reportHistoryRepository.update(historyId, { status: ReportStatus.PROCESSING });

    try {
      const payload = await this.buildPayload(dto, actorEmail);
      const generator = this.generators[dto.format];
      const generated = await generator.generate(payload);

      const file = await this.filesService.store({
        ownerUserId: actorId,
        category: FileCategory.REPORT_EXPORT,
        buffer: generated.buffer,
        originalName: generated.filename,
        mimeType: generated.mimeType,
      });

      await this.reportHistoryRepository.update(historyId, {
        status: ReportStatus.COMPLETED,
        fileId: file.id,
        completedAt: new Date(),
      });

      await this.auditService.record({
        actorUserId: actorId,
        action: AuditAction.REPORT_GENERATED,
        entityType: 'ReportHistory',
        entityId: historyId,
        metadata: { reportType: dto.reportType, format: dto.format },
      });
    } catch (error) {
      await this.reportHistoryRepository.update(historyId, {
        status: ReportStatus.FAILED,
        errorMessage: (error as Error).message.slice(0, 1000),
      });
    }
  }

  private async buildPayload(dto: CreateReportDto, actorEmail: string): Promise<ReportPayload> {
    const filters: Record<string, string> = {};
    if (dto.counterpartyId) filters.counterpartyId = dto.counterpartyId;

    const payload: ReportPayload = {
      title: this.titleFor(dto.reportType),
      periodLabel: `${dto.from} to ${dto.to}`,
      generatedAt: new Date(),
      generatedByEmail: actorEmail,
      filters,
      tables: [],
    };

    switch (dto.reportType) {
      case ReportType.TRIAL_BALANCE: {
        const rows = await this.analyticsService.trialBalance(dto.from, dto.to);
        payload.tables.push({
          title: 'Trial Balance',
          columns: [
            { key: 'accountCode', header: 'Account' },
            { key: 'accountName', header: 'Name' },
            { key: 'accountType', header: 'Type' },
            { key: 'debitTurnover', header: 'Debit', numeric: true },
            { key: 'creditTurnover', header: 'Credit', numeric: true },
            { key: 'balance', header: 'Balance', numeric: true },
          ],
          rows: rows as unknown as Record<string, string | number>[],
        });
        break;
      }
      case ReportType.PROFIT_AND_LOSS: {
        const result = await this.analyticsService.profitAndLoss(dto.from, dto.to);
        payload.tables.push(
          this.singleRowTable('Profit & Loss', result as unknown as Record<string, string>),
        );
        break;
      }
      case ReportType.CASH_FLOW: {
        const result = await this.analyticsService.cashFlow(dto.from, dto.to);
        payload.tables.push(
          this.singleRowTable('Cash Flow', result as unknown as Record<string, string>),
        );
        break;
      }
      case ReportType.COUNTERPARTY_BALANCES: {
        const rows = await this.analyticsService.counterpartyBalances(dto.to, dto.counterpartyId);
        payload.tables.push({
          title: 'Counterparty Balances',
          columns: [
            { key: 'counterpartyId', header: 'Counterparty' },
            { key: 'accountCode', header: 'Account' },
            { key: 'accountName', header: 'Name' },
            { key: 'debitTurnover', header: 'Debit', numeric: true },
            { key: 'creditTurnover', header: 'Credit', numeric: true },
            { key: 'balance', header: 'Balance', numeric: true },
          ],
          rows: rows as unknown as Record<string, string | number>[],
        });
        break;
      }
    }

    return payload;
  }

  private singleRowTable(title: string, data: Record<string, string>): ReportTable {
    const { from: _from, to: _to, ...rest } = data;
    const columns = Object.keys(rest).map((key) => ({ key, header: humanize(key), numeric: true }));
    return { title, columns, rows: [rest] };
  }

  private titleFor(type: ReportType): string {
    switch (type) {
      case ReportType.TRIAL_BALANCE:
        return 'Trial Balance';
      case ReportType.PROFIT_AND_LOSS:
        return 'Profit and Loss Statement';
      case ReportType.CASH_FLOW:
        return 'Cash Flow Statement';
      case ReportType.COUNTERPARTY_BALANCES:
        return 'Counterparty Balances';
    }
  }
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}
