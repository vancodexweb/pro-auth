import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Counterparty } from './entities/counterparty.entity';
import { CounterpartyContact } from './entities/counterparty-contact.entity';
import { CounterpartyBankAccount } from './entities/counterparty-bank-account.entity';
import { CounterpartiesService } from './counterparties.service';
import { CounterpartiesController } from './counterparties.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Counterparty, CounterpartyContact, CounterpartyBankAccount])],
  controllers: [CounterpartiesController],
  providers: [CounterpartiesService],
  exports: [CounterpartiesService, TypeOrmModule],
})
export class CounterpartiesModule {}
