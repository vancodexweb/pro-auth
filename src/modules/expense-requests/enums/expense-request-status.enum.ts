export enum ExpenseRequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  ACCOUNTED = 'ACCOUNTED',
  CANCELLED = 'CANCELLED',
}

export const ALLOWED_EXPENSE_REQUEST_TRANSITIONS: Record<
  ExpenseRequestStatus,
  ExpenseRequestStatus[]
> = {
  [ExpenseRequestStatus.DRAFT]: [ExpenseRequestStatus.SUBMITTED, ExpenseRequestStatus.CANCELLED],
  [ExpenseRequestStatus.SUBMITTED]: [ExpenseRequestStatus.APPROVED, ExpenseRequestStatus.REJECTED],
  [ExpenseRequestStatus.APPROVED]: [ExpenseRequestStatus.PAID, ExpenseRequestStatus.CANCELLED],
  [ExpenseRequestStatus.REJECTED]: [ExpenseRequestStatus.DRAFT],
  [ExpenseRequestStatus.PAID]: [ExpenseRequestStatus.ACCOUNTED],
  [ExpenseRequestStatus.ACCOUNTED]: [],
  [ExpenseRequestStatus.CANCELLED]: [],
};

export const EXPENSE_REQUEST_EDITABLE_STATUSES = [
  ExpenseRequestStatus.DRAFT,
  ExpenseRequestStatus.REJECTED,
];
