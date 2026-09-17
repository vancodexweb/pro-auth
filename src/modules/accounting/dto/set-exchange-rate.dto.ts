import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, MaxLength } from 'class-validator';
import { IsRate } from '../../../common/validators/is-rate.decorator';

export class SetExchangeRateDto {
  @ApiProperty({ example: 'EUR' })
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiProperty({
    example: '1.085000',
    description: 'Units of base currency per 1 unit of `currency`',
  })
  @IsRate()
  rateToBase: string;

  @ApiProperty({ example: '2024-03-15' })
  @IsDateString()
  rateDate: string;
}
