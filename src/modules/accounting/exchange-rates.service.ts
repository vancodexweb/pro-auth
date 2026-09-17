import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { SetExchangeRateDto } from './dto/set-exchange-rate.dto';

@Injectable()
export class ExchangeRatesService {
  constructor(
    @InjectRepository(ExchangeRate)
    private readonly exchangeRateRepository: Repository<ExchangeRate>,
    private readonly configService: ConfigService,
  ) {}

  baseCurrency(): string {
    return this.configService.get<string>('app.baseCurrency')!;
  }

  async set(dto: SetExchangeRateDto): Promise<ExchangeRate> {
    const currency = dto.currency.toUpperCase();
    if (currency === this.baseCurrency()) {
      throw new ConflictException('Cannot set an exchange rate for the base currency');
    }
    const existing = await this.exchangeRateRepository.findOne({
      where: { currency, rateDate: dto.rateDate },
    });
    if (existing) {
      existing.rateToBase = dto.rateToBase;
      return this.exchangeRateRepository.save(existing);
    }
    return this.exchangeRateRepository.save(
      this.exchangeRateRepository.create({
        currency,
        rateToBase: dto.rateToBase,
        rateDate: dto.rateDate,
      }),
    );
  }

  /** Rate to convert `currency` into the base currency, as of the most recent rate on or before `date`. */
  async getRate(currency: string, date: string): Promise<string> {
    const normalized = currency.toUpperCase();
    if (normalized === this.baseCurrency()) return '1.000000';

    const rate = await this.exchangeRateRepository.findOne({
      where: { currency: normalized, rateDate: LessThanOrEqual(date) },
      order: { rateDate: 'DESC' },
    });
    if (!rate) {
      throw new NotFoundException(`No exchange rate found for ${normalized} on or before ${date}`);
    }
    return rate.rateToBase;
  }

  findAll(currency?: string): Promise<ExchangeRate[]> {
    return this.exchangeRateRepository.find({
      where: currency ? { currency: currency.toUpperCase() } : {},
      order: { currency: 'ASC', rateDate: 'DESC' },
    });
  }
}
