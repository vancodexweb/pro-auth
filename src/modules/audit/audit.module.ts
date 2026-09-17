import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

/**
 * Global because AuditService is injected from almost every other module
 * (auth, documents, expense requests, payments, budgets, accounting...).
 * Repeating `imports: [AuditModule]` in a dozen modules would be pure
 * boilerplate for a cross-cutting concern like this one.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
