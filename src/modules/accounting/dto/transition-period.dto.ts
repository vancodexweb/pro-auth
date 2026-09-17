import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PeriodStatus } from '../enums/period-status.enum';

export class TransitionPeriodDto {
  @ApiProperty({ enum: PeriodStatus })
  @IsEnum(PeriodStatus)
  status: PeriodStatus;
}
