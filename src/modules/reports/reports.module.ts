import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportHistory } from './entities/report-history.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportJobQueue } from './report-job-queue';
import { XlsxReportGenerator } from './generators/xlsx.generator';
import { PdfReportGenerator } from './generators/pdf.generator';
import { DocxReportGenerator } from './generators/docx.generator';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReportHistory]), AnalyticsModule, FilesModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportJobQueue,
    XlsxReportGenerator,
    PdfReportGenerator,
    DocxReportGenerator,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
