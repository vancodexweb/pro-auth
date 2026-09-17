import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1789672691237 implements MigrationInterface {
  name = 'InitialSchema1789672691237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."files_category_enum" AS ENUM('PASSPORT_MAIN_PAGE', 'PASSPORT_REGISTRATION_PAGE', 'FACE_PHOTO', 'DOCUMENT_ATTACHMENT', 'REPORT_EXPORT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ownerUserId" uuid NOT NULL, "category" "public"."files_category_enum" NOT NULL, "originalName" character varying(255) NOT NULL, "mimeType" character varying(100) NOT NULL, "sizeBytes" integer NOT NULL, "storageKey" character varying(512) NOT NULL, "checksumSha256" character(64) NOT NULL, CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."expense_requests_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'ACCOUNTED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expense_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "requestNumber" character varying(30) NOT NULL, "requestedByUserId" uuid NOT NULL, "departmentId" uuid, "costCenterId" uuid, "projectId" uuid, "expenseAccountId" uuid NOT NULL, "amount" numeric(18,2) NOT NULL, "currency" character varying(3) NOT NULL, "purpose" character varying(1000) NOT NULL, "status" "public"."expense_requests_status_enum" NOT NULL DEFAULT 'DRAFT', "rejectionReason" character varying(500), "paymentId" uuid, "journalEntryId" uuid, CONSTRAINT "PK_c65452ab2916139e0ce4748941e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_15ee668e41eb83c3edb1cb4b29" ON "expense_requests" ("requestNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b26d6f1e8050c5a9301b8bd2cd" ON "expense_requests" ("requestedByUserId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."expense_request_approvals_action_enum" AS ENUM('SUBMIT', 'APPROVE', 'REJECT', 'CANCEL', 'RESUBMIT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "expense_request_approvals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expenseRequestId" uuid NOT NULL, "actorUserId" uuid NOT NULL, "action" "public"."expense_request_approvals_action_enum" NOT NULL, "comment" character varying(500), CONSTRAINT "PK_a199159b5edbaca053ffe44c684" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_028c36c19e7db443933f5f3656" ON "expense_request_approvals" ("expenseRequestId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."financial_documents_type_enum" AS ENUM('INVOICE', 'ACT', 'WAYBILL', 'RECEIPT', 'WRITE_OFF', 'CORRECTION', 'INTERNAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."financial_documents_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "financial_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "documentNumber" character varying(30) NOT NULL, "type" "public"."financial_documents_type_enum" NOT NULL, "date" date NOT NULL, "counterpartyId" uuid, "contractId" uuid, "currency" character varying(3) NOT NULL, "amountTotal" numeric(18,2) NOT NULL, "status" "public"."financial_documents_status_enum" NOT NULL DEFAULT 'DRAFT', "description" character varying(1000) NOT NULL, "createdByUserId" uuid NOT NULL, "approvedByUserId" uuid, "approvedAt" TIMESTAMP WITH TIME ZONE, "rejectionReason" character varying(500), "postedJournalEntryId" uuid, "correctionOfDocumentId" uuid, CONSTRAINT "PK_14fa5d6ba2395a372c2d7153bc0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e2bc00fbae3d3eecb15558033b" ON "financial_documents" ("documentNumber") `,
    );
    await queryRunner.query(
      `CREATE TABLE "financial_document_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "documentId" uuid NOT NULL, "lineNo" integer NOT NULL, "description" character varying(500) NOT NULL, "amount" numeric(18,2) NOT NULL, "debitAccountId" uuid NOT NULL, "creditAccountId" uuid NOT NULL, "costCenterId" uuid, "projectId" uuid, CONSTRAINT "PK_9cbbdc49f11dacb61463ad042b0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53eb199e5e168fa1f6863aa043" ON "financial_document_lines" ("documentId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."counterparties_type_enum" AS ENUM('CUSTOMER', 'SUPPLIER', 'BOTH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "counterparties" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "legalName" character varying(255) NOT NULL, "taxId" character varying(20) NOT NULL, "registrationNumber" character varying(30), "type" "public"."counterparties_type_enum" NOT NULL, "legalAddress" character varying(500) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9f045dc184ca2426af5e9dfb13b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c3d418678f2b6d7a25d48f2052" ON "counterparties" ("taxId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "counterparty_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "counterpartyId" uuid NOT NULL, "fullName" character varying(200) NOT NULL, "position" character varying(150), "phone" character varying(50), "email" character varying(255), CONSTRAINT "PK_956f2e4406df2fb3905c48665c4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a56b115cd1692580abea597a6e" ON "counterparty_contacts" ("counterpartyId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "counterparty_bank_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "counterpartyId" uuid NOT NULL, "bankName" character varying(255) NOT NULL, "accountNumber" character varying(50) NOT NULL, "bic" character varying(20) NOT NULL, "currency" character varying(3) NOT NULL, CONSTRAINT "PK_e2184531f759ad012a7e4bf2cbb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e66f369d479a2c6072c64e2972" ON "counterparty_bank_accounts" ("counterpartyId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."contracts_status_enum" AS ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'TERMINATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "contracts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "number" character varying(50) NOT NULL, "counterpartyId" uuid NOT NULL, "subject" character varying(500) NOT NULL, "startDate" date NOT NULL, "endDate" date, "status" "public"."contracts_status_enum" NOT NULL DEFAULT 'DRAFT', "amount" numeric(18,2) NOT NULL, "currency" character varying(3) NOT NULL, CONSTRAINT "PK_2c7b8f3a7b1acdd49497d83d0fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7f9a578e633d6521bcc2d9cc8c" ON "contracts" ("number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6ed1a51c1a6fca7baa87348f61" ON "contracts" ("counterpartyId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."budgets_status_enum" AS ENUM('DRAFT', 'APPROVED', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "budgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "periodId" uuid NOT NULL, "status" "public"."budgets_status_enum" NOT NULL DEFAULT 'DRAFT', "createdByUserId" uuid NOT NULL, "approvedByUserId" uuid, "approvedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cda23ebcadbc519ac386ca5bba" ON "budgets" ("periodId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "budget_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "budgetId" uuid NOT NULL, "accountId" uuid NOT NULL, "departmentId" uuid, "costCenterId" uuid, "projectId" uuid, "plannedAmount" numeric(18,2) NOT NULL, CONSTRAINT "PK_4eabf9c9d7c8edc9ad302270c94" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e4dd62c3eb6b8bcbd4613f802b" ON "budget_lines" ("budgetId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(100) NOT NULL, "description" character varying(255) NOT NULL, CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE ("code"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "description" character varying(255), CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('PENDING_EMAIL_VERIFICATION', 'PENDING_ADMIN_APPROVAL', 'ACTIVE', 'BLOCKED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION', "roleId" uuid NOT NULL, "emailVerifiedAt" TIMESTAMP WITH TIME ZONE, "approvedAt" TIMESTAMP WITH TIME ZONE, "approvedByUserId" uuid, "rejectedAt" TIMESTAMP WITH TIME ZONE, "rejectionReason" character varying(500), "blockedAt" TIMESTAMP WITH TIME ZONE, "blockedReason" character varying(500), "failedLoginAttempts" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "lastLoginAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "tokenHash" character(64) NOT NULL, "familyId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "replacedByTokenHash" character(64), "userAgent" character varying(255), "ipAddress" inet, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c25bc63d248ca90e8dcc1d92d0" ON "refresh_tokens" ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "tokenHash" character(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consumedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d6a19d4b4f6c62dcd29daa497e" ON "password_reset_tokens" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "codeHash" character(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consumedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_10f285d038feb767bf7c2da14b" ON "email_verification_tokens" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorUserId" uuid, "action" character varying(100) NOT NULL, "entityType" character varying(100) NOT NULL, "entityId" uuid, "metadata" jsonb, "ipAddress" inet, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e36d23e1e7cf81ea77758bef79" ON "audit_logs" ("actorUserId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON "audit_logs" ("entityType", "entityId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."financial_periods_status_enum" AS ENUM('OPEN', 'CLOSING', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "financial_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "year" integer NOT NULL, "month" integer NOT NULL, "status" "public"."financial_periods_status_enum" NOT NULL DEFAULT 'OPEN', "closedAt" TIMESTAMP WITH TIME ZONE, "closedByUserId" uuid, CONSTRAINT "UQ_6a6f30ec7eb1723370809e307b5" UNIQUE ("year", "month"), CONSTRAINT "PK_15c5a68bb4e3a1bc2232c829265" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."journal_entries_status_enum" AS ENUM('POSTED', 'REVERSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "journal_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "entryNumber" character varying(30) NOT NULL, "periodId" uuid NOT NULL, "date" date NOT NULL, "description" character varying(500) NOT NULL, "sourceType" character varying(100) NOT NULL, "sourceId" uuid, "status" "public"."journal_entries_status_enum" NOT NULL DEFAULT 'POSTED', "createdByUserId" uuid NOT NULL, "reversalOfEntryId" uuid, CONSTRAINT "PK_a70368e64230434457c8d007ab3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4b3b30432878ce7cc7882e919b" ON "journal_entries" ("entryNumber") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_38fde500a97555ce0902d35179" ON "journal_entries" ("periodId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accounts_type_enum" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(20) NOT NULL, "name" character varying(150) NOT NULL, "type" "public"."accounts_type_enum" NOT NULL, "parentId" uuid, "isCash" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_490319656e54a7957dc1fed027" ON "accounts" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "journal_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "journalEntryId" uuid NOT NULL, "lineNo" integer NOT NULL, "accountId" uuid NOT NULL, "debit" numeric(18,2) NOT NULL, "credit" numeric(18,2) NOT NULL, "currency" character varying(3) NOT NULL, "exchangeRate" numeric(18,6) NOT NULL, "baseCurrencyDebit" numeric(18,2) NOT NULL, "baseCurrencyCredit" numeric(18,2) NOT NULL, "counterpartyId" uuid, "contractId" uuid, "costCenterId" uuid, "projectId" uuid, "description" character varying(500), CONSTRAINT "PK_70cba2da4588cee8921f73ef136" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3c913ef1f691ce5b2c49011630" ON "journal_lines" ("journalEntryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9eecc536593997a18359db2b4" ON "journal_lines" ("accountId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "exchange_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "currency" character varying(3) NOT NULL, "rateToBase" numeric(18,6) NOT NULL, "rateDate" date NOT NULL, CONSTRAINT "UQ_26a7d32f4e93c683e2ef49be392" UNIQUE ("currency", "rateDate"), CONSTRAINT "PK_33a614bad9e61956079d817ebe2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_history_reporttype_enum" AS ENUM('TRIAL_BALANCE', 'PROFIT_AND_LOSS', 'CASH_FLOW', 'COUNTERPARTY_BALANCES')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_history_format_enum" AS ENUM('XLSX', 'PDF', 'DOCX')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_history_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "requestedByUserId" uuid NOT NULL, "reportType" "public"."report_history_reporttype_enum" NOT NULL, "format" "public"."report_history_format_enum" NOT NULL, "parameters" jsonb NOT NULL, "periodFrom" date, "periodTo" date, "status" "public"."report_history_status_enum" NOT NULL DEFAULT 'PENDING', "fileId" uuid, "errorMessage" character varying(1000), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0726ab3f23515cc0344e9cf551c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bbe21ef8096f6335214b1aa3ce" ON "report_history" ("requestedByUserId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."person_profiles_gender_enum" AS ENUM('MALE', 'FEMALE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "person_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "lastName" character varying(100) NOT NULL, "firstName" character varying(100) NOT NULL, "middleName" character varying(100), "birthDate" date NOT NULL, "gender" "public"."person_profiles_gender_enum" NOT NULL, "birthPlace" character varying(255) NOT NULL, "countryOfResidence" character varying(100) NOT NULL, "countryOfRegistration" character varying(100) NOT NULL, "cityOfRegistration" character varying(100) NOT NULL, "street" character varying(255) NOT NULL, "registrationDate" date NOT NULL, "facePhotoFileId" uuid NOT NULL, CONSTRAINT "PK_1aabf6efcab759de90d3c6481d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4e0549dc4af3112df95ad7d73d" ON "person_profiles" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."employees_status_enum" AS ENUM('ACTIVE', 'TERMINATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "employeeNumber" character varying(20) NOT NULL, "departmentId" uuid, "position" character varying(150) NOT NULL, "hireDate" date NOT NULL, "status" "public"."employees_status_enum" NOT NULL DEFAULT 'ACTIVE', "terminatedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_737991e10350d9626f592894ce" ON "employees" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1de36734659e4fb0b941bd4b6e" ON "employees" ("employeeNumber") `,
    );
    await queryRunner.query(
      `CREATE TABLE "passport_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "personProfileId" uuid NOT NULL, "issuedBy" character varying(255) NOT NULL, "issueDate" date NOT NULL, "subdivisionCode" character varying(20) NOT NULL, "mainPagePhotoFileId" uuid NOT NULL, "registrationPagePhotoFileId" uuid NOT NULL, CONSTRAINT "REL_93c337b3156787bb85e6beb9c2" UNIQUE ("personProfileId"), CONSTRAINT "PK_908d148960613a7d3af82ed8bd4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_93c337b3156787bb85e6beb9c2" ON "passport_documents" ("personProfileId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_direction_enum" AS ENUM('INCOMING', 'OUTGOING')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_method_enum" AS ENUM('BANK_TRANSFER', 'CASH', 'CARD', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "idempotencyKey" character varying(100) NOT NULL, "direction" "public"."payments_direction_enum" NOT NULL, "counterpartyId" uuid, "contractId" uuid, "expenseRequestId" uuid, "financialDocumentId" uuid, "cashAccountId" uuid NOT NULL, "counterAccountId" uuid NOT NULL, "amount" numeric(18,2) NOT NULL, "currency" character varying(3) NOT NULL, "exchangeRate" numeric(18,6) NOT NULL, "baseCurrencyAmount" numeric(18,2) NOT NULL, "paymentDate" date NOT NULL, "method" "public"."payments_method_enum" NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "description" character varying(1000), "failureReason" character varying(500), "journalEntryId" uuid, "createdByUserId" uuid NOT NULL, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_743b9fb1d2a059f2f7860418e4" ON "payments" ("idempotencyKey") `,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(20) NOT NULL, "name" character varying(150) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_d95a87318392465ab663a32cc4f" UNIQUE ("code"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(20) NOT NULL, "name" character varying(150) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_91fddbe23e927e1e525c152baa3" UNIQUE ("code"), CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "cost_centers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(20) NOT NULL, "name" character varying(150) NOT NULL, "departmentId" uuid, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_65430a1f13f0bd89fb211401373" UNIQUE ("code"), CONSTRAINT "PK_e70f55c677c255c1f81f0ed1ccb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0a14614e2b41922b376ed1121b" ON "cost_centers" ("departmentId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permissions" ("roleId" uuid NOT NULL, "permissionId" uuid NOT NULL, CONSTRAINT "PK_d430a02aad006d8a70f3acd7d03" PRIMARY KEY ("roleId", "permissionId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4599f8b8f548d35850afa2d12" ON "role_permissions" ("roleId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06792d0c62ce6b0203c03643cd" ON "role_permissions" ("permissionId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_request_approvals" ADD CONSTRAINT "FK_028c36c19e7db443933f5f36561" FOREIGN KEY ("expenseRequestId") REFERENCES "expense_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_document_lines" ADD CONSTRAINT "FK_53eb199e5e168fa1f6863aa0436" FOREIGN KEY ("documentId") REFERENCES "financial_documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "counterparty_contacts" ADD CONSTRAINT "FK_a56b115cd1692580abea597a6ed" FOREIGN KEY ("counterpartyId") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "counterparty_bank_accounts" ADD CONSTRAINT "FK_e66f369d479a2c6072c64e29724" FOREIGN KEY ("counterpartyId") REFERENCES "counterparties"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" ADD CONSTRAINT "FK_6ed1a51c1a6fca7baa87348f612" FOREIGN KEY ("counterpartyId") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "budget_lines" ADD CONSTRAINT "FK_e4dd62c3eb6b8bcbd4613f802b6" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_368e146b785b574f42ae9e53d5e" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_38fde500a97555ce0902d351795" FOREIGN KEY ("periodId") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "FK_3c913ef1f691ce5b2c490116309" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" ADD CONSTRAINT "FK_d9eecc536593997a18359db2b47" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "passport_documents" ADD CONSTRAINT "FK_93c337b3156787bb85e6beb9c2a" FOREIGN KEY ("personProfileId") REFERENCES "person_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_centers" ADD CONSTRAINT "FK_0a14614e2b41922b376ed1121bb" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_centers" DROP CONSTRAINT "FK_0a14614e2b41922b376ed1121bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "passport_documents" DROP CONSTRAINT "FK_93c337b3156787bb85e6beb9c2a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "FK_d9eecc536593997a18359db2b47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT "FK_3c913ef1f691ce5b2c490116309"`,
    );
    await queryRunner.query(
      `ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_38fde500a97555ce0902d351795"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_368e146b785b574f42ae9e53d5e"`);
    await queryRunner.query(
      `ALTER TABLE "budget_lines" DROP CONSTRAINT "FK_e4dd62c3eb6b8bcbd4613f802b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contracts" DROP CONSTRAINT "FK_6ed1a51c1a6fca7baa87348f612"`,
    );
    await queryRunner.query(
      `ALTER TABLE "counterparty_bank_accounts" DROP CONSTRAINT "FK_e66f369d479a2c6072c64e29724"`,
    );
    await queryRunner.query(
      `ALTER TABLE "counterparty_contacts" DROP CONSTRAINT "FK_a56b115cd1692580abea597a6ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_document_lines" DROP CONSTRAINT "FK_53eb199e5e168fa1f6863aa0436"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expense_request_approvals" DROP CONSTRAINT "FK_028c36c19e7db443933f5f36561"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_06792d0c62ce6b0203c03643cd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b4599f8b8f548d35850afa2d12"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0a14614e2b41922b376ed1121b"`);
    await queryRunner.query(`DROP TABLE "cost_centers"`);
    await queryRunner.query(`DROP TABLE "departments"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_743b9fb1d2a059f2f7860418e4"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_direction_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_93c337b3156787bb85e6beb9c2"`);
    await queryRunner.query(`DROP TABLE "passport_documents"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1de36734659e4fb0b941bd4b6e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_737991e10350d9626f592894ce"`);
    await queryRunner.query(`DROP TABLE "employees"`);
    await queryRunner.query(`DROP TYPE "public"."employees_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4e0549dc4af3112df95ad7d73d"`);
    await queryRunner.query(`DROP TABLE "person_profiles"`);
    await queryRunner.query(`DROP TYPE "public"."person_profiles_gender_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bbe21ef8096f6335214b1aa3ce"`);
    await queryRunner.query(`DROP TABLE "report_history"`);
    await queryRunner.query(`DROP TYPE "public"."report_history_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."report_history_format_enum"`);
    await queryRunner.query(`DROP TYPE "public"."report_history_reporttype_enum"`);
    await queryRunner.query(`DROP TABLE "exchange_rates"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d9eecc536593997a18359db2b4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3c913ef1f691ce5b2c49011630"`);
    await queryRunner.query(`DROP TABLE "journal_lines"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_490319656e54a7957dc1fed027"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TYPE "public"."accounts_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_38fde500a97555ce0902d35179"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4b3b30432878ce7cc7882e919b"`);
    await queryRunner.query(`DROP TABLE "journal_entries"`);
    await queryRunner.query(`DROP TYPE "public"."journal_entries_status_enum"`);
    await queryRunner.query(`DROP TABLE "financial_periods"`);
    await queryRunner.query(`DROP TYPE "public"."financial_periods_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_13c69424c440a0e765053feb4b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e36d23e1e7cf81ea77758bef79"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_10f285d038feb767bf7c2da14b"`);
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d6a19d4b4f6c62dcd29daa497e"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c25bc63d248ca90e8dcc1d92d0"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e4dd62c3eb6b8bcbd4613f802b"`);
    await queryRunner.query(`DROP TABLE "budget_lines"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cda23ebcadbc519ac386ca5bba"`);
    await queryRunner.query(`DROP TABLE "budgets"`);
    await queryRunner.query(`DROP TYPE "public"."budgets_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6ed1a51c1a6fca7baa87348f61"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7f9a578e633d6521bcc2d9cc8c"`);
    await queryRunner.query(`DROP TABLE "contracts"`);
    await queryRunner.query(`DROP TYPE "public"."contracts_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e66f369d479a2c6072c64e2972"`);
    await queryRunner.query(`DROP TABLE "counterparty_bank_accounts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a56b115cd1692580abea597a6e"`);
    await queryRunner.query(`DROP TABLE "counterparty_contacts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c3d418678f2b6d7a25d48f2052"`);
    await queryRunner.query(`DROP TABLE "counterparties"`);
    await queryRunner.query(`DROP TYPE "public"."counterparties_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_53eb199e5e168fa1f6863aa043"`);
    await queryRunner.query(`DROP TABLE "financial_document_lines"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e2bc00fbae3d3eecb15558033b"`);
    await queryRunner.query(`DROP TABLE "financial_documents"`);
    await queryRunner.query(`DROP TYPE "public"."financial_documents_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."financial_documents_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_028c36c19e7db443933f5f3656"`);
    await queryRunner.query(`DROP TABLE "expense_request_approvals"`);
    await queryRunner.query(`DROP TYPE "public"."expense_request_approvals_action_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b26d6f1e8050c5a9301b8bd2cd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_15ee668e41eb83c3edb1cb4b29"`);
    await queryRunner.query(`DROP TABLE "expense_requests"`);
    await queryRunner.query(`DROP TYPE "public"."expense_requests_status_enum"`);
    await queryRunner.query(`DROP TABLE "files"`);
    await queryRunner.query(`DROP TYPE "public"."files_category_enum"`);
  }
}
