import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PaymentDirection } from '../enums/payment-direction.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export class QueryPaymentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentDirection })
  @IsOptional()
  @IsEnum(PaymentDirection)
  direction?: PaymentDirection;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;
}
