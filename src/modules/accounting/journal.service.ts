import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { QueryJournalEntriesDto } from './dto/query-journal-entries.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';

export interface AccountMovement {
  journalEntryId: string;
  entryNumber: string;
  date: string;
  description: string;
  debit: string;
  credit: string;
}

@Injectable()
export class JournalService {
  constructor(
    @InjectRepository(JournalEntry) private readonly entryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalLine) private readonly lineRepository: Repository<JournalLine>,
  ) {}

  async findEntries(query: QueryJournalEntriesDto): Promise<PaginatedResult<JournalEntry>> {
    const qb = this.entryRepository.createQueryBuilder('entry');
    if (query.periodId) qb.andWhere('entry.periodId = :periodId', { periodId: query.periodId });
    if (query.sourceType) {
      qb.andWhere('entry.sourceType = :sourceType', { sourceType: query.sourceType });
    }
    if (query.from) qb.andWhere('entry.date >= :from', { from: query.from });
    if (query.to) qb.andWhere('entry.date <= :to', { to: query.to });
    if (query.accountId) {
      qb.innerJoin('journal_lines', 'line', 'line."journalEntryId" = entry.id').andWhere(
        'line."accountId" = :accountId',
        { accountId: query.accountId },
      );
    }
    qb.orderBy('entry.date', 'DESC').addOrderBy('entry.entryNumber', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findEntryById(id: string): Promise<JournalEntry & { lines: JournalLine[] }> {
    const entry = await this.entryRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Journal entry not found');
    const lines = await this.lineRepository.find({
      where: { journalEntryId: id },
      order: { lineNo: 'ASC' },
    });
    return { ...entry, lines };
  }

  async accountMovements(
    accountId: string,
    from?: string,
    to?: string,
  ): Promise<AccountMovement[]> {
    const qb = this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('journal_entries', 'entry', 'entry.id = line."journalEntryId"')
      .where('line."accountId" = :accountId', { accountId })
      .select([
        'line."journalEntryId" as "journalEntryId"',
        'entry."entryNumber" as "entryNumber"',
        'entry.date as date',
        'entry.description as description',
        'line.debit as debit',
        'line.credit as credit',
      ])
      .orderBy('entry.date', 'ASC');

    if (from) qb.andWhere('entry.date >= :from', { from });
    if (to) qb.andWhere('entry.date <= :to', { to });

    return qb.getRawMany<AccountMovement>();
  }
}
