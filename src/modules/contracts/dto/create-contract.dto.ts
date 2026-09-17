import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsMoneyAmount } from '../../../common/validators/is-money-amount.decorator';

export class CreateContractDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  number: string;

  @ApiProperty()
  @IsUUID()
  counterpartyId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  subject: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: '150000.00' })
  @IsMoneyAmount()
  amount: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MaxLength(3)
  currency: string;
}
