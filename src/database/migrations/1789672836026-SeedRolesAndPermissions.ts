import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the two roles required by the spec (WORKER, ADMIN) and the
 * permission codes the application checks via `@RequirePermissions(...)`.
 *
 * Deliberately hardcodes the permission codes as SQL literals instead of
 * importing `common/constants/permissions.constant.ts`: a migration must
 * keep producing the exact same result years from now even if that source
 * file changes, so migrations never import mutable application code.
 * Adding a new role later is a new migration (or an admin data change),
 * never an edit of this one.
 */
export class SeedRolesAndPermissions1789672836026 implements MigrationInterface {
  private readonly permissions: Array<[string, string]> = [
    ['users.manage', 'Approve, reject, block and manage user accounts'],
    ['org.manage', 'Manage departments, cost centers and projects'],
    ['counterparties.manage', 'Create and edit counterparties, contacts and bank accounts'],
    ['contracts.manage', 'Create and edit contracts'],
    ['accounting.manage', 'Manage chart of accounts, exchange rates and financial periods'],
    ['documents.manage', 'Create, edit and submit financial documents'],
    ['documents.approve', 'Approve or reject submitted financial documents'],
    ['documents.post', 'Post approved financial documents to the ledger, and reverse postings'],
    ['expense_requests.manage', 'Create, edit and submit expense requests'],
    ['expense_requests.approve', 'Approve or reject submitted expense requests'],
    ['payments.execute', 'Execute payments'],
    ['budgets.manage', 'Create and edit budgets'],
    ['budgets.approve', 'Approve and close budgets'],
    ['reports.generate', 'Generate reports'],
    ['reports.read_all', "Read every user's report history, not just their own"],
    ['analytics.read', 'Read financial analytics and journal data'],
    ['audit.read', 'Read the audit log'],
  ];

  private readonly workerPermissions = [
    'documents.manage',
    'expense_requests.manage',
    'reports.generate',
    'analytics.read',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [code, description] of this.permissions) {
      await queryRunner.query(`INSERT INTO permissions (code, description) VALUES ($1, $2)`, [
        code,
        description,
      ]);
    }

    await queryRunner.query(`INSERT INTO roles (name, description) VALUES ($1, $2)`, [
      'WORKER',
      'Standard employee account: manages their own documents and expense requests',
    ]);
    await queryRunner.query(`INSERT INTO roles (name, description) VALUES ($1, $2)`, [
      'ADMIN',
      'Full administrative access to every module',
    ]);

    const workerId = (await queryRunner.query(`SELECT id FROM roles WHERE name = 'WORKER'`))[0].id;
    const adminId = (await queryRunner.query(`SELECT id FROM roles WHERE name = 'ADMIN'`))[0].id;

    for (const code of this.workerPermissions) {
      await queryRunner.query(
        `INSERT INTO role_permissions ("roleId", "permissionId")
         SELECT $1, id FROM permissions WHERE code = $2`,
        [workerId, code],
      );
    }

    // ADMIN gets every permission that exists.
    await queryRunner.query(
      `INSERT INTO role_permissions ("roleId", "permissionId") SELECT $1, id FROM permissions`,
      [adminId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM role_permissions`);
    await queryRunner.query(`DELETE FROM roles WHERE name IN ('WORKER', 'ADMIN')`);
    await queryRunner.query(`DELETE FROM permissions WHERE code = ANY($1)`, [
      this.permissions.map(([code]) => code),
    ]);
  }
}
