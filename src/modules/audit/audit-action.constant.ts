/**
 * Not an exhaustive enum enforced everywhere - callers may log other
 * ad-hoc action strings - but every action required by the spec (auth
 * events, approvals, postings, payments, period closing, reports) has a
 * named constant here so it is typo-proof and greppable.
 */
export const AuditAction = {
  USER_REGISTERED: 'user.registered',
  EMAIL_VERIFIED: 'user.email_verified',
  USER_APPROVED: 'user.approved',
  USER_REJECTED: 'user.rejected',
  USER_BLOCKED: 'user.blocked',
  USER_UNBLOCKED: 'user.unblocked',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_LOGOUT: 'user.logout',
  PASSWORD_CHANGED: 'user.password_changed',
  PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'user.password_reset_completed',

  PERIOD_OPENED: 'accounting.period_opened',
  PERIOD_CLOSING_STARTED: 'accounting.period_closing_started',
  PERIOD_CLOSED: 'accounting.period_closed',

  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_SUBMITTED: 'document.submitted',
  DOCUMENT_APPROVED: 'document.approved',
  DOCUMENT_REJECTED: 'document.rejected',
  DOCUMENT_POSTED: 'document.posted',
  DOCUMENT_CANCELLED: 'document.cancelled',
  DOCUMENT_CORRECTED: 'document.corrected',
  DOCUMENT_REVERSED: 'document.reversed',

  EXPENSE_REQUEST_CREATED: 'expense_request.created',
  EXPENSE_REQUEST_SUBMITTED: 'expense_request.submitted',
  EXPENSE_REQUEST_APPROVED: 'expense_request.approved',
  EXPENSE_REQUEST_REJECTED: 'expense_request.rejected',

  PAYMENT_EXECUTED: 'payment.executed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',

  BUDGET_CREATED: 'budget.created',
  BUDGET_APPROVED: 'budget.approved',

  REPORT_GENERATED: 'report.generated',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
