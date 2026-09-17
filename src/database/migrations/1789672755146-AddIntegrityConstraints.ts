import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Everything TypeORM's schema sync cannot express from entity metadata
 * alone:
 *  - sequences backing the human-readable document/entry numbers,
 *  - foreign keys for the deliberately-plain cross-module uuid columns
 *    (see the "no ORM relation across module boundaries" comments on
 *    those entities) - the module boundary is a TypeScript-level
 *    decision, referential integrity at the database level still applies,
 *  - the CHECK constraint and trigger that make SUM(DEBIT) = SUM(CREDIT)
 *    a database-enforced invariant, not just an application-level one.
 */
export class AddIntegrityConstraints1789672755146 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --- Sequences for human-readable document numbers ---
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq`);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS financial_document_number_seq`);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS expense_request_number_seq`);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS employee_number_seq`);

    // --- CHECK constraint: a journal line is a debit OR a credit, never both, never negative ---
    await queryRunner.query(`
      ALTER TABLE "journal_lines"
      ADD CONSTRAINT "CHK_journal_lines_debit_xor_credit"
      CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0))
    `);

    // --- Defense in depth: DB-level balance check for POSTED journal entries ---
    // The application (PostingService) already refuses to create an unbalanced
    // entry; this trigger means that invariant holds even if a future code
    // path, a manual `psql` session, or a bug bypasses the service layer.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_journal_entry_balance() RETURNS TRIGGER AS $$
      DECLARE
        entry_id uuid;
        entry_status text;
        total_debit numeric(18,2);
        total_credit numeric(18,2);
      BEGIN
        entry_id := COALESCE(NEW."journalEntryId", OLD."journalEntryId");

        SELECT status INTO entry_status FROM journal_entries WHERE id = entry_id;
        IF entry_status IS DISTINCT FROM 'POSTED' THEN
          RETURN NULL;
        END IF;

        SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
          INTO total_debit, total_credit
          FROM journal_lines WHERE "journalEntryId" = entry_id;

        IF total_debit <> total_credit THEN
          RAISE EXCEPTION 'Journal entry % is not balanced: debit % <> credit %',
            entry_id, total_debit, total_credit;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER trg_journal_entry_balance
      AFTER INSERT OR UPDATE OR DELETE ON journal_lines
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION check_journal_entry_balance();
    `);

    // --- Cross-module foreign keys ---
    const foreignKeys: Array<[string, string, string, string, string]> = [
      // [table, column, refTable, refColumn, onDelete]
      ['files', 'ownerUserId', 'users', 'id', 'RESTRICT'],
      ['person_profiles', 'userId', 'users', 'id', 'CASCADE'],
      ['person_profiles', 'facePhotoFileId', 'files', 'id', 'RESTRICT'],
      ['passport_documents', 'mainPagePhotoFileId', 'files', 'id', 'RESTRICT'],
      ['passport_documents', 'registrationPagePhotoFileId', 'files', 'id', 'RESTRICT'],
      ['employees', 'userId', 'users', 'id', 'CASCADE'],
      ['employees', 'departmentId', 'departments', 'id', 'SET NULL'],
      ['users', 'approvedByUserId', 'users', 'id', 'SET NULL'],
      ['refresh_tokens', 'userId', 'users', 'id', 'CASCADE'],
      ['password_reset_tokens', 'userId', 'users', 'id', 'CASCADE'],
      ['email_verification_tokens', 'userId', 'users', 'id', 'CASCADE'],
      ['audit_logs', 'actorUserId', 'users', 'id', 'SET NULL'],

      ['accounts', 'parentId', 'accounts', 'id', 'SET NULL'],
      ['journal_entries', 'createdByUserId', 'users', 'id', 'RESTRICT'],
      ['journal_entries', 'reversalOfEntryId', 'journal_entries', 'id', 'SET NULL'],
      ['journal_lines', 'counterpartyId', 'counterparties', 'id', 'SET NULL'],
      ['journal_lines', 'contractId', 'contracts', 'id', 'SET NULL'],
      ['journal_lines', 'costCenterId', 'cost_centers', 'id', 'SET NULL'],
      ['journal_lines', 'projectId', 'projects', 'id', 'SET NULL'],
      ['financial_periods', 'closedByUserId', 'users', 'id', 'SET NULL'],

      ['counterparty_contacts', 'counterpartyId', 'counterparties', 'id', 'CASCADE'],

      ['financial_documents', 'counterpartyId', 'counterparties', 'id', 'SET NULL'],
      ['financial_documents', 'contractId', 'contracts', 'id', 'SET NULL'],
      ['financial_documents', 'createdByUserId', 'users', 'id', 'RESTRICT'],
      ['financial_documents', 'approvedByUserId', 'users', 'id', 'SET NULL'],
      ['financial_documents', 'postedJournalEntryId', 'journal_entries', 'id', 'SET NULL'],
      ['financial_documents', 'correctionOfDocumentId', 'financial_documents', 'id', 'SET NULL'],
      ['financial_document_lines', 'debitAccountId', 'accounts', 'id', 'RESTRICT'],
      ['financial_document_lines', 'creditAccountId', 'accounts', 'id', 'RESTRICT'],
      ['financial_document_lines', 'costCenterId', 'cost_centers', 'id', 'SET NULL'],
      ['financial_document_lines', 'projectId', 'projects', 'id', 'SET NULL'],

      ['expense_requests', 'requestedByUserId', 'users', 'id', 'RESTRICT'],
      ['expense_requests', 'departmentId', 'departments', 'id', 'SET NULL'],
      ['expense_requests', 'costCenterId', 'cost_centers', 'id', 'SET NULL'],
      ['expense_requests', 'projectId', 'projects', 'id', 'SET NULL'],
      ['expense_requests', 'expenseAccountId', 'accounts', 'id', 'RESTRICT'],
      ['expense_requests', 'journalEntryId', 'journal_entries', 'id', 'SET NULL'],
      ['expense_request_approvals', 'actorUserId', 'users', 'id', 'RESTRICT'],

      ['payments', 'counterpartyId', 'counterparties', 'id', 'SET NULL'],
      ['payments', 'contractId', 'contracts', 'id', 'SET NULL'],
      ['payments', 'expenseRequestId', 'expense_requests', 'id', 'SET NULL'],
      ['payments', 'financialDocumentId', 'financial_documents', 'id', 'SET NULL'],
      ['payments', 'cashAccountId', 'accounts', 'id', 'RESTRICT'],
      ['payments', 'counterAccountId', 'accounts', 'id', 'RESTRICT'],
      ['payments', 'journalEntryId', 'journal_entries', 'id', 'SET NULL'],
      ['payments', 'createdByUserId', 'users', 'id', 'RESTRICT'],
      ['expense_requests', 'paymentId', 'payments', 'id', 'SET NULL'],

      ['budgets', 'periodId', 'financial_periods', 'id', 'RESTRICT'],
      ['budgets', 'createdByUserId', 'users', 'id', 'RESTRICT'],
      ['budgets', 'approvedByUserId', 'users', 'id', 'SET NULL'],
      ['budget_lines', 'accountId', 'accounts', 'id', 'RESTRICT'],
      ['budget_lines', 'departmentId', 'departments', 'id', 'SET NULL'],
      ['budget_lines', 'costCenterId', 'cost_centers', 'id', 'SET NULL'],
      ['budget_lines', 'projectId', 'projects', 'id', 'SET NULL'],

      ['report_history', 'requestedByUserId', 'users', 'id', 'RESTRICT'],
      ['report_history', 'fileId', 'files', 'id', 'SET NULL'],
    ];

    for (const [table, column, refTable, refColumn, onDelete] of foreignKeys) {
      const constraintName = `FK_${table}_${column}`;
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}")
        ON DELETE ${onDelete} ON UPDATE NO ACTION
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_journal_entry_balance ON journal_lines`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_journal_entry_balance`);
    await queryRunner.query(
      `ALTER TABLE "journal_lines" DROP CONSTRAINT IF EXISTS "CHK_journal_lines_debit_xor_credit"`,
    );
    await queryRunner.query(`DROP SEQUENCE IF EXISTS journal_entry_number_seq`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS financial_document_number_seq`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS expense_request_number_seq`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS employee_number_seq`);
    // Foreign keys are dropped automatically when the tables are dropped by
    // the InitialSchema migration's own `down()`; nothing else to undo here.
  }
}
