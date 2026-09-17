import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ContractStatus } from '../enums/contract-status.enum';

export class ChangeContractStatusDto {
  @ApiProperty({ enum: ContractStatus })
  @IsEnum(ContractStatus)
  status: ContractStatus;
}
