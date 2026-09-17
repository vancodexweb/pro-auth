import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaymentDirection } from '../enums/payment-direction.enum';
import { PaymentMethod } from '../enums/payment-status.enum';
import { IsMoneyAmount } from '../../../common/validators/is-money-amount.decorator';

export class CreatePaymentDto {
  @ApiProperty({
    description:
      'Client-generated key. Retrying the same logical payment with the same key is safe.',
    example: 'a5c1a0d6-2f1a-4a3e-9b1e-4a7b3c9e0d21',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  idempotencyKey: string;

  @ApiProperty({ enum: PaymentDirection })
  @IsEnum(PaymentDirection)
  direction: PaymentDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiPropertyOptional({ description: 'If set, the payment settles this expense request.' })
  @IsOptional()
  @IsUUID()
  expenseRequestId?: string;

  @ApiPropertyOptional({
    description: 'If set, the payment is linked to this financial document (e.g. an invoice).',
  })
  @IsOptional()
  @IsUUID()
  financialDocumentId?: string;

  @ApiProperty({ description: 'Our GL bank/cash account' })
  @IsUUID()
  cashAccountId: string;

  @ApiPropertyOptional({
    description:
      'The other GL account (e.g. AR/AP or expense). Required unless expenseRequestId is set.',
  })
  @IsOptional()
  @IsUUID()
  counterAccountId?: string;

  @ApiProperty({ example: '500.00' })
  @IsMoneyAmount()
  amount: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiProperty({ example: '2024-03-20' })
  @IsDateString()
  paymentDate: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
