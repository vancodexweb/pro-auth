import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { CounterpartiesModule } from '../counterparties/counterparties.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contract]), CounterpartiesModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService, TypeOrmModule],
})
export class ContractsModule {}
