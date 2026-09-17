export enum BudgetStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  CLOSED = 'CLOSED',
}

export const ALLOWED_BUDGET_TRANSITIONS: Record<BudgetStatus, BudgetStatus[]> = {
  [BudgetStatus.DRAFT]: [BudgetStatus.APPROVED],
  [BudgetStatus.APPROVED]: [BudgetStatus.CLOSED],
  [BudgetStatus.CLOSED]: [],
};
