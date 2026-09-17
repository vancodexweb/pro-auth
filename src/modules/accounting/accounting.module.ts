import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { FinancialPeriod } from './entities/financial-period.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalLine } from './entities/journal-line.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { AccountsService } from './accounts.service';
import { PeriodsService } from './periods.service';
import { PostingService } from './posting.service';
import { JournalService } from './journal.service';
import { ExchangeRatesService } from './exchange-rates.service';
import { AccountsController } from './accounts.controller';
import { PeriodsController } from './periods.controller';
import { JournalController } from './journal.controller';
import { ExchangeRatesController } from './exchange-rates.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, FinancialPeriod, JournalEntry, JournalLine, ExchangeRate]),
  ],
  controllers: [AccountsController, PeriodsController, JournalController, ExchangeRatesController],
  providers: [
    AccountsService,
    PeriodsService,
    PostingService,
    JournalService,
    ExchangeRatesService,
  ],
  exports: [AccountsService, PeriodsService, PostingService, JournalService, ExchangeRatesService],
})
export class AccountingModule {}
