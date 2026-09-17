import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  constructor(@InjectRepository(Account) private readonly accountRepository: Repository<Account>) {}

  async create(dto: CreateAccountDto): Promise<Account> {
    const existing = await this.accountRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Account code "${dto.code}" already exists`);

    if (dto.parentId) {
      await this.findById(dto.parentId);
    }

    return this.accountRepository.save(
      this.accountRepository.create({
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId ?? null,
        isCash: dto.isCash ?? false,
      }),
    );
  }

  findAll(): Promise<Account[]> {
    return this.accountRepository.find({ order: { code: 'ASC' } });
  }

  async findById(id: string): Promise<Account> {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async findByCode(code: string): Promise<Account> {
    const account = await this.accountRepository.findOne({ where: { code } });
    if (!account) throw new NotFoundException(`Account "${code}" not found`);
    return account;
  }

  async assertActive(id: string): Promise<Account> {
    const account = await this.findById(id);
    if (!account.isActive) {
      throw new ConflictException(`Account "${account.code}" is inactive and cannot be posted to`);
    }
    return account;
  }

  async deactivate(id: string): Promise<Account> {
    const account = await this.findById(id);
    account.isActive = false;
    return this.accountRepository.save(account);
  }
}
