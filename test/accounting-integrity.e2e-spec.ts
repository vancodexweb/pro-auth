import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source';

/**
 * Integration test against the real database (not the app, not mocks):
 * proves the balance trigger from migration 1789672755146 is real defense
 * in depth, not just documentation - it rejects an unbalanced journal_lines
 * change even when the write bypasses PostingService entirely, and the
 * transaction that attempted it leaves no trace behind.
 */
describe('Ledger integrity constraints (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function seedUser(): Promise<string> {
    const [role] = await dataSource.query(`SELECT id FROM roles WHERE name = 'WORKER'`);
    const [user] = await dataSource.query(
      `INSERT INTO users (email, "passwordHash", status, "roleId")
       VALUES ($1, 'x', 'ACTIVE', $2) RETURNING id`,
      [`integration-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, role.id],
    );
    return user.id;
  }

  async function seedBalancedEntry(): Promise<{ entryId: string; accountId: string }> {
    const userId = await seedUser();
    const [period] = await dataSource.query(
      `INSERT INTO financial_periods (year, month, status) VALUES (9999, 1, 'OPEN')
       ON CONFLICT (year, month) DO UPDATE SET status = 'OPEN' RETURNING id`,
    );
    const [account] = await dataSource.query(
      `INSERT INTO accounts (code, name, type) VALUES ($1, 'Integration test account', 'ASSET')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [`INTEG-${Date.now()}`],
    );
    const [entry] = await dataSource.query(
      `INSERT INTO journal_entries
         ("entryNumber", "periodId", date, description, "sourceType", "createdByUserId", status)
       VALUES ($1, $2, '9999-01-15', 'Integration test entry', 'ManualEntry', $3, 'POSTED')
       RETURNING id`,
      [`JE-TEST-${Date.now()}`, period.id, userId],
    );
    await dataSource.query(
      `INSERT INTO journal_lines
         (id, "createdAt", "updatedAt", "journalEntryId", "lineNo", "accountId", debit, credit, currency, "exchangeRate", "baseCurrencyDebit", "baseCurrencyCredit")
       VALUES
         (uuid_generate_v4(), now(), now(), $1, 1, $2, 100.00, 0, 'USD', 1, 100.00, 0),
         (uuid_generate_v4(), now(), now(), $1, 2, $2, 0, 100.00, 'USD', 1, 0, 100.00)`,
      [entry.id, account.id],
    );
    return { entryId: entry.id, accountId: account.id };
  }

  it('accepts a genuinely balanced entry', async () => {
    const { entryId } = await seedBalancedEntry();
    const lines = await dataSource.query(
      `SELECT debit, credit FROM journal_lines WHERE "journalEntryId" = $1`,
      [entryId],
    );
    expect(lines).toHaveLength(2);
  });

  it('rejects an unbalanced insert on a POSTED entry and rolls back the whole transaction', async () => {
    const { entryId, accountId } = await seedBalancedEntry();

    await expect(
      dataSource.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO journal_lines
             (id, "createdAt", "updatedAt", "journalEntryId", "lineNo", "accountId", debit, credit, currency, "exchangeRate", "baseCurrencyDebit", "baseCurrencyCredit")
           VALUES (uuid_generate_v4(), now(), now(), $1, 99, $2, 50.00, 0, 'USD', 1, 50.00, 0)`,
          [entryId, accountId],
        );
        // Also insert an unrelated marker row in the SAME transaction, to
        // prove the whole transaction rolls back - not just the bad statement.
        await manager.query(
          `INSERT INTO departments (code, name) VALUES ($1, 'Should not survive rollback')`,
          [`RB${Date.now().toString(36)}`],
        );
      }),
    ).rejects.toThrow(/not balanced/);

    const lines = await dataSource.query(
      `SELECT debit, credit FROM journal_lines WHERE "journalEntryId" = $1`,
      [entryId],
    );
    expect(lines).toHaveLength(2); // the bad third line never persisted

    const markers = await dataSource.query(
      `SELECT id FROM departments WHERE name = 'Should not survive rollback'`,
    );
    expect(markers).toHaveLength(0); // proves the whole transaction rolled back
  });

  it('the CHECK constraint rejects a line that is simultaneously a debit and a credit', async () => {
    const { entryId, accountId } = await seedBalancedEntry();

    await expect(
      dataSource.query(
        `INSERT INTO journal_lines
           (id, "createdAt", "updatedAt", "journalEntryId", "lineNo", "accountId", debit, credit, currency, "exchangeRate", "baseCurrencyDebit", "baseCurrencyCredit")
         VALUES (uuid_generate_v4(), now(), now(), $1, 99, $2, 10.00, 10.00, 'USD', 1, 10.00, 10.00)`,
        [entryId, accountId],
      ),
    ).rejects.toThrow(/CHK_journal_lines_debit_xor_credit/);
  });
});
