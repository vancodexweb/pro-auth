import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialDocument } from './entities/financial-document.entity';
import { FinancialDocumentLine } from './entities/financial-document-line.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [TypeOrmModule.forFeature([FinancialDocument, FinancialDocumentLine]), AccountingModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService, TypeOrmModule],
})
export class DocumentsModule {}
