import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  mailConfig,
  storageConfig,
} from './config/configuration';
import { validate } from './config/env.validation';
import { buildTypeOrmOptions } from './database/typeorm.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PeopleModule } from './modules/people/people.module';
import { FilesModule } from './modules/files/files.module';
import { OrgModule } from './modules/org/org.module';
import { CounterpartiesModule } from './modules/counterparties/counterparties.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ExpenseRequestsModule } from './modules/expense-requests/expense-requests.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [appConfig, databaseConfig, jwtConfig, mailConfig, storageConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    HealthModule,
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    PeopleModule,
    FilesModule,
    OrgModule,
    CounterpartiesModule,
    ContractsModule,
    AccountingModule,
    DocumentsModule,
    ExpenseRequestsModule,
    PaymentsModule,
    BudgetsModule,
    AnalyticsModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
