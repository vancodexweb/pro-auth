import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Counterparty } from './entities/counterparty.entity';
import { CounterpartyContact } from './entities/counterparty-contact.entity';
import { CounterpartyBankAccount } from './entities/counterparty-bank-account.entity';
import {
  CreateBankAccountDto,
  CreateContactDto,
  CreateCounterpartyDto,
} from './dto/create-counterparty.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';
import { QueryCounterpartiesDto } from './dto/query-counterparties.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';

export interface CounterpartyDetail extends Counterparty {
  contacts: CounterpartyContact[];
  bankAccounts: CounterpartyBankAccount[];
}

@Injectable()
export class CounterpartiesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Counterparty)
    private readonly counterpartyRepository: Repository<Counterparty>,
    @InjectRepository(CounterpartyContact)
    private readonly contactRepository: Repository<CounterpartyContact>,
    @InjectRepository(CounterpartyBankAccount)
    private readonly bankAccountRepository: Repository<CounterpartyBankAccount>,
  ) {}

  async create(dto: CreateCounterpartyDto): Promise<CounterpartyDetail> {
    const existing = await this.counterpartyRepository.findOne({ where: { taxId: dto.taxId } });
    if (existing)
      throw new ConflictException(`Counterparty with taxId "${dto.taxId}" already exists`);

    return this.dataSource.transaction(async (manager) => {
      const counterpartyRepo = manager.getRepository(Counterparty);
      const counterparty = await counterpartyRepo.save(
        counterpartyRepo.create({
          name: dto.name,
          legalName: dto.legalName,
          taxId: dto.taxId,
          registrationNumber: dto.registrationNumber ?? null,
          type: dto.type,
          legalAddress: dto.legalAddress,
        }),
      );

      const contacts = await this.saveContacts(manager, counterparty.id, dto.contacts ?? []);
      const bankAccounts = await this.saveBankAccounts(
        manager,
        counterparty.id,
        dto.bankAccounts ?? [],
      );

      return { ...counterparty, contacts, bankAccounts };
    });
  }

  async findAll(query: QueryCounterpartiesDto): Promise<PaginatedResult<Counterparty>> {
    const qb = this.counterpartyRepository.createQueryBuilder('counterparty');
    if (query.search) {
      qb.andWhere('(counterparty.name ILIKE :search OR counterparty.legalName ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.type) qb.andWhere('counterparty.type = :type', { type: query.type });
    if (query.isActive !== undefined) {
      qb.andWhere('counterparty.isActive = :isActive', { isActive: query.isActive === 'true' });
    }
    qb.orderBy('counterparty.name', 'ASC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<CounterpartyDetail> {
    const counterparty = await this.counterpartyRepository.findOne({ where: { id } });
    if (!counterparty) throw new NotFoundException('Counterparty not found');
    const [contacts, bankAccounts] = await Promise.all([
      this.contactRepository.find({ where: { counterpartyId: id } }),
      this.bankAccountRepository.find({ where: { counterpartyId: id } }),
    ]);
    return { ...counterparty, contacts, bankAccounts };
  }

  async update(id: string, dto: UpdateCounterpartyDto): Promise<CounterpartyDetail> {
    const counterparty = await this.counterpartyRepository.findOne({ where: { id } });
    if (!counterparty) throw new NotFoundException('Counterparty not found');

    if (dto.taxId && dto.taxId !== counterparty.taxId) {
      const clash = await this.counterpartyRepository.findOne({ where: { taxId: dto.taxId } });
      if (clash)
        throw new ConflictException(`Counterparty with taxId "${dto.taxId}" already exists`);
    }

    Object.assign(counterparty, dto);
    await this.counterpartyRepository.save(counterparty);
    return this.findById(id);
  }

  async deactivate(id: string): Promise<Counterparty> {
    const counterparty = await this.counterpartyRepository.findOne({ where: { id } });
    if (!counterparty) throw new NotFoundException('Counterparty not found');
    counterparty.isActive = false;
    return this.counterpartyRepository.save(counterparty);
  }

  async addContact(counterpartyId: string, dto: CreateContactDto): Promise<CounterpartyContact> {
    await this.assertExists(counterpartyId);
    return this.contactRepository.save(this.contactRepository.create({ counterpartyId, ...dto }));
  }

  async addBankAccount(
    counterpartyId: string,
    dto: CreateBankAccountDto,
  ): Promise<CounterpartyBankAccount> {
    await this.assertExists(counterpartyId);
    return this.bankAccountRepository.save(
      this.bankAccountRepository.create({ counterpartyId, ...dto }),
    );
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.counterpartyRepository.exists({ where: { id } });
    if (!exists) throw new NotFoundException('Counterparty not found');
  }

  private saveContacts(
    manager: DataSource['manager'],
    counterpartyId: string,
    contacts: CreateContactDto[],
  ): Promise<CounterpartyContact[]> {
    const repo = manager.getRepository(CounterpartyContact);
    return repo.save(contacts.map((contact) => repo.create({ counterpartyId, ...contact })));
  }

  private saveBankAccounts(
    manager: DataSource['manager'],
    counterpartyId: string,
    bankAccounts: CreateBankAccountDto[],
  ): Promise<CounterpartyBankAccount[]> {
    const repo = manager.getRepository(CounterpartyBankAccount);
    return repo.save(bankAccounts.map((account) => repo.create({ counterpartyId, ...account })));
  }
}
