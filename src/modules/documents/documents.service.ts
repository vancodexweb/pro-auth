import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FinancialDocument } from './entities/financial-document.entity';
import { FinancialDocumentLine } from './entities/financial-document-line.entity';
import {
  ALLOWED_DOCUMENT_TRANSITIONS,
  DocumentStatus,
  EDITABLE_STATUSES,
} from './enums/document-status.enum';
import { DocumentType } from './enums/document-type.enum';
import { CreateDocumentDto, CreateDocumentLineDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { PostingService } from '../accounting/posting.service';
import { JournalService } from '../accounting/journal.service';
import { ExchangeRatesService } from '../accounting/exchange-rates.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.constant';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';
import { fromMinorUnits, sumMinorUnits } from '../../common/utils/decimal.util';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(FinancialDocument)
    private readonly documentRepository: Repository<FinancialDocument>,
    @InjectRepository(FinancialDocumentLine)
    private readonly lineRepository: Repository<FinancialDocumentLine>,
    private readonly postingService: PostingService,
    private readonly journalService: JournalService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateDocumentDto, actorId: string): Promise<FinancialDocument> {
    return this.dataSource.transaction(async (manager) => {
      const documentNumber = await this.nextDocumentNumber(manager);
      const documentRepo = manager.getRepository(FinancialDocument);
      const document = await documentRepo.save(
        documentRepo.create({
          documentNumber,
          type: dto.type,
          date: dto.date,
          counterpartyId: dto.counterpartyId ?? null,
          contractId: dto.contractId ?? null,
          currency: dto.currency,
          amountTotal: sumAmount(dto.lines),
          status: DocumentStatus.DRAFT,
          description: dto.description,
          createdByUserId: actorId,
        }),
      );

      await this.replaceLines(manager, document.id, dto.lines);

      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.DOCUMENT_CREATED,
          entityType: 'FinancialDocument',
          entityId: document.id,
          metadata: { documentNumber, type: dto.type },
        },
        manager,
      );

      return document;
    });
  }

  async findAll(query: QueryDocumentsDto): Promise<PaginatedResult<FinancialDocument>> {
    const qb = this.documentRepository.createQueryBuilder('doc');
    if (query.type) qb.andWhere('doc.type = :type', { type: query.type });
    if (query.status) qb.andWhere('doc.status = :status', { status: query.status });
    if (query.counterpartyId) {
      qb.andWhere('doc.counterpartyId = :counterpartyId', { counterpartyId: query.counterpartyId });
    }
    qb.orderBy('doc.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<FinancialDocument & { lines: FinancialDocumentLine[] }> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');
    const lines = await this.lineRepository.find({
      where: { documentId: id },
      order: { lineNo: 'ASC' },
    });
    return { ...document, lines };
  }

  async update(id: string, dto: UpdateDocumentDto, actorId: string): Promise<FinancialDocument> {
    return this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(FinancialDocument);
      const document = await documentRepo.findOne({ where: { id } });
      if (!document) throw new NotFoundException('Document not found');
      if (document.createdByUserId !== actorId) {
        throw new ForbiddenException('You can only edit documents you created');
      }
      if (!EDITABLE_STATUSES.includes(document.status)) {
        throw new ConflictException(`Document cannot be edited in status ${document.status}`);
      }

      if (document.status === DocumentStatus.REJECTED) {
        document.status = DocumentStatus.DRAFT;
        document.rejectionReason = null;
      }

      Object.assign(document, {
        type: dto.type ?? document.type,
        date: dto.date ?? document.date,
        counterpartyId: dto.counterpartyId ?? document.counterpartyId,
        contractId: dto.contractId ?? document.contractId,
        currency: dto.currency ?? document.currency,
        description: dto.description ?? document.description,
      });

      if (dto.lines) {
        document.amountTotal = sumAmount(dto.lines);
        await this.replaceLines(manager, document.id, dto.lines);
      }

      return documentRepo.save(document);
    });
  }

  async submit(id: string, actorId: string): Promise<FinancialDocument> {
    return this.transition(id, DocumentStatus.SUBMITTED, actorId, async (document, manager) => {
      if (document.createdByUserId !== actorId) {
        throw new ForbiddenException('You can only submit documents you created');
      }
      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.DOCUMENT_SUBMITTED,
          entityType: 'FinancialDocument',
          entityId: id,
        },
        manager,
      );
    });
  }

  async approve(id: string, actorId: string): Promise<FinancialDocument> {
    return this.transition(id, DocumentStatus.APPROVED, actorId, async (_document, manager) => {
      await manager.getRepository(FinancialDocument).update(id, {
        approvedByUserId: actorId,
        approvedAt: new Date(),
      });
      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.DOCUMENT_APPROVED,
          entityType: 'FinancialDocument',
          entityId: id,
        },
        manager,
      );
    });
  }

  async reject(id: string, actorId: string, reason: string): Promise<FinancialDocument> {
    return this.transition(id, DocumentStatus.REJECTED, actorId, async (_document, manager) => {
      await manager.getRepository(FinancialDocument).update(id, { rejectionReason: reason });
      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.DOCUMENT_REJECTED,
          entityType: 'FinancialDocument',
          entityId: id,
          metadata: { reason },
        },
        manager,
      );
    });
  }

  async cancel(id: string, actorId: string): Promise<FinancialDocument> {
    return this.transition(id, DocumentStatus.CANCELLED, actorId, async (_document, manager) => {
      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.DOCUMENT_CANCELLED,
          entityType: 'FinancialDocument',
          entityId: id,
        },
        manager,
      );
    });
  }

  /**
   * Posting is the one transition that also has a side effect outside the
   * documents table (a balanced journal entry). Both must commit or roll
   * back together, so everything happens inside one transaction and the
   * document row is locked for its duration - two concurrent "post"
   * requests for the same document must never both succeed.
   */
  async post(id: string, actorId: string): Promise<FinancialDocument> {
    return this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(FinancialDocument);
      const document = await documentRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!document) throw new NotFoundException('Document not found');

      const allowed = ALLOWED_DOCUMENT_TRANSITIONS[document.status];
      if (!allowed.includes(DocumentStatus.POSTED)) {
        throw new ConflictException(`Document cannot be posted from status ${document.status}`);
      }

      const lines = await manager
        .getRepository(FinancialDocumentLine)
        .find({ where: { documentId: id }, order: { lineNo: 'ASC' } });

      const rate = await this.exchangeRatesService.getRate(document.currency, document.date);

      const journalEntry = await this.postingService.post(
        {
          date: document.date,
          description: `${document.type} ${document.documentNumber}: ${document.description}`,
          sourceType: 'FinancialDocument',
          sourceId: document.id,
          createdByUserId: actorId,
          lines: lines.flatMap((line) => [
            {
              accountId: line.debitAccountId,
              debit: line.amount,
              credit: '0.00',
              currency: document.currency,
              exchangeRate: rate,
              counterpartyId: document.counterpartyId,
              contractId: document.contractId,
              costCenterId: line.costCenterId,
              projectId: line.projectId,
              description: line.description,
            },
            {
              accountId: line.creditAccountId,
              debit: '0.00',
              credit: line.amount,
              currency: document.currency,
              exchangeRate: rate,
              counterpartyId: document.counterpartyId,
              contractId: document.contractId,
              costCenterId: line.costCenterId,
              projectId: line.projectId,
              description: line.description,
            },
          ]),
        },
        manager,
      );

      document.status = DocumentStatus.POSTED;
      document.postedJournalEntryId = journalEntry.id;
      await documentRepo.save(document);

      return document;
    });
  }

  /**
   * Reverses a POSTED document: reverses its journal entry and creates a
   * sibling CORRECTION document for the paper trail. The original document
   * row is never edited, only its status changes to REVERSED.
   */
  async reverse(id: string, actorId: string, reason: string): Promise<FinancialDocument> {
    return this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(FinancialDocument);
      const document = await documentRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!document) throw new NotFoundException('Document not found');
      if (document.status !== DocumentStatus.POSTED) {
        throw new ConflictException('Only a POSTED document can be reversed');
      }
      if (!document.postedJournalEntryId) {
        throw new ConflictException('Document has no associated journal entry');
      }

      const originalEntry = await this.journalService.findEntryById(document.postedJournalEntryId);
      const today = new Date().toISOString().slice(0, 10);
      await this.postingService.reverse(originalEntry, actorId, today, manager);

      document.status = DocumentStatus.REVERSED;
      await documentRepo.save(document);

      const correctionNumber = await this.nextDocumentNumber(manager);
      const correction = await documentRepo.save(
        documentRepo.create({
          documentNumber: correctionNumber,
          type: DocumentType.CORRECTION,
          date: today,
          counterpartyId: document.counterpartyId,
          contractId: document.contractId,
          currency: document.currency,
          amountTotal: document.amountTotal,
          status: DocumentStatus.POSTED,
          description: `Reversal of ${document.documentNumber}: ${reason}`,
          createdByUserId: actorId,
          approvedByUserId: actorId,
          approvedAt: new Date(),
          correctionOfDocumentId: document.id,
        }),
      );

      await this.auditService.record(
        {
          actorUserId: actorId,
          action: AuditAction.DOCUMENT_CORRECTED,
          entityType: 'FinancialDocument',
          entityId: document.id,
          metadata: { reason, correctionDocumentId: correction.id },
        },
        manager,
      );

      return document;
    });
  }

  private async transition(
    id: string,
    next: DocumentStatus,
    _actorId: string,
    sideEffect: (document: FinancialDocument, manager: EntityManager) => Promise<void>,
  ): Promise<FinancialDocument> {
    return this.dataSource.transaction(async (manager) => {
      const documentRepo = manager.getRepository(FinancialDocument);
      const document = await documentRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!document) throw new NotFoundException('Document not found');

      const allowed = ALLOWED_DOCUMENT_TRANSITIONS[document.status];
      if (!allowed.includes(next)) {
        throw new ConflictException(
          `Cannot transition document from ${document.status} to ${next}`,
        );
      }

      document.status = next;
      await documentRepo.save(document);
      // sideEffect must use `manager`, never the outer non-transactional
      // repository - that row is still locked by this same transaction,
      // and a second connection trying to touch it would wait forever for
      // a commit that itself is waiting on this call to return.
      await sideEffect(document, manager);
      return document;
    });
  }

  private async replaceLines(
    manager: EntityManager,
    documentId: string,
    lines: CreateDocumentLineDto[],
  ): Promise<void> {
    const lineRepo = manager.getRepository(FinancialDocumentLine);
    await lineRepo.delete({ documentId });
    await lineRepo.save(
      lines.map((line, index) =>
        lineRepo.create({
          documentId,
          lineNo: index + 1,
          description: line.description,
          amount: line.amount,
          debitAccountId: line.debitAccountId,
          creditAccountId: line.creditAccountId,
          costCenterId: line.costCenterId ?? null,
          projectId: line.projectId ?? null,
        }),
      ),
    );
  }

  private async nextDocumentNumber(manager: EntityManager): Promise<string> {
    const result = await manager.query<{ val: string }[]>(
      "SELECT nextval('financial_document_number_seq') as val",
    );
    return `DOC-${result[0].val.padStart(8, '0')}`;
  }
}

function sumAmount(lines: CreateDocumentLineDto[]): string {
  const totalMinor = sumMinorUnits(lines.map((line) => line.amount));
  if (totalMinor <= 0n) {
    throw new BadRequestException('Document must have at least one line with a positive amount');
  }
  return fromMinorUnits(totalMinor);
}
