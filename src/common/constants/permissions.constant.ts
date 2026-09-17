/**
 * Single source of truth for permission codes.
 * Roles are just named bundles of these codes (see database/seeds).
 * Adding a new role/permission combination is a data change (seed a row),
 * never a code change here.
 */
export enum Permission {
  USERS_MANAGE = 'users.manage',
  ORG_MANAGE = 'org.manage',
  COUNTERPARTIES_MANAGE = 'counterparties.manage',
  CONTRACTS_MANAGE = 'contracts.manage',
  ACCOUNTING_MANAGE = 'accounting.manage',
  DOCUMENTS_MANAGE = 'documents.manage',
  DOCUMENTS_APPROVE = 'documents.approve',
  DOCUMENTS_POST = 'documents.post',
  EXPENSE_REQUESTS_MANAGE = 'expense_requests.manage',
  EXPENSE_REQUESTS_APPROVE = 'expense_requests.approve',
  PAYMENTS_EXECUTE = 'payments.execute',
  BUDGETS_MANAGE = 'budgets.manage',
  BUDGETS_APPROVE = 'budgets.approve',
  REPORTS_GENERATE = 'reports.generate',
  REPORTS_READ_ALL = 'reports.read_all',
  ANALYTICS_READ = 'analytics.read',
  AUDIT_READ = 'audit.read',
}

export const WORKER_PERMISSIONS: Permission[] = [
  Permission.DOCUMENTS_MANAGE,
  Permission.EXPENSE_REQUESTS_MANAGE,
  Permission.REPORTS_GENERATE,
  Permission.ANALYTICS_READ,
];

export const ADMIN_PERMISSIONS: Permission[] = Object.values(Permission);

export const ROLE_WORKER = 'WORKER';
export const ROLE_ADMIN = 'ADMIN';
