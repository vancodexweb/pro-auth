import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseRequest } from './entities/expense-request.entity';
import { ExpenseRequestApproval } from './entities/expense-request-approval.entity';
import { ExpenseRequestsService } from './expense-requests.service';
import { ExpenseRequestsController } from './expense-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseRequest, ExpenseRequestApproval])],
  controllers: [ExpenseRequestsController],
  providers: [ExpenseRequestsService],
  exports: [ExpenseRequestsService, TypeOrmModule],
})
export class ExpenseRequestsModule {}
