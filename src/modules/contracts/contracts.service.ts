import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ALLOWED_CONTRACT_TRANSITIONS, ContractStatus } from './enums/contract-status.enum';
import { CreateContractDto } from './dto/create-contract.dto';
import { QueryContractsDto } from './dto/query-contracts.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination-query.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract) private readonly contractRepository: Repository<Contract>,
  ) {}

  async create(dto: CreateContractDto): Promise<Contract> {
    const existing = await this.contractRepository.findOne({ where: { number: dto.number } });
    if (existing) throw new ConflictException(`Contract number "${dto.number}" already exists`);

    return this.contractRepository.save(
      this.contractRepository.create({
        number: dto.number,
        counterpartyId: dto.counterpartyId,
        subject: dto.subject,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        amount: dto.amount,
        currency: dto.currency,
        status: ContractStatus.DRAFT,
      }),
    );
  }

  async findAll(query: QueryContractsDto): Promise<PaginatedResult<Contract>> {
    const qb = this.contractRepository.createQueryBuilder('contract');
    if (query.counterpartyId) {
      qb.andWhere('contract.counterpartyId = :counterpartyId', {
        counterpartyId: query.counterpartyId,
      });
    }
    if (query.status) qb.andWhere('contract.status = :status', { status: query.status });
    qb.orderBy('contract.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query);
  }

  async findById(id: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({ where: { id } });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async changeStatus(id: string, next: ContractStatus): Promise<Contract> {
    const contract = await this.findById(id);
    const allowed = ALLOWED_CONTRACT_TRANSITIONS[contract.status];
    if (!allowed.includes(next)) {
      throw new ConflictException(`Cannot transition contract from ${contract.status} to ${next}`);
    }
    contract.status = next;
    return this.contractRepository.save(contract);
  }
}
