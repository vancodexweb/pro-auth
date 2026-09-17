import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReportFormat, ReportType } from '../enums/report-type.enum';

export class CreateReportDto {
  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  reportType: ReportType;

  @ApiProperty({ enum: ReportFormat })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2024-12-31' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ description: 'Only used by COUNTERPARTY_BALANCES' })
  @IsOptional()
  @IsUUID()
  counterpartyId?: string;
}
