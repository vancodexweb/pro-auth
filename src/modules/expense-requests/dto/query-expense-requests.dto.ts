import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ExpenseRequestStatus } from '../enums/expense-request-status.enum';

export class QueryExpenseRequestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ExpenseRequestStatus })
  @IsOptional()
  @IsEnum(ExpenseRequestStatus)
  status?: ExpenseRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requestedByUserId?: string;
}
