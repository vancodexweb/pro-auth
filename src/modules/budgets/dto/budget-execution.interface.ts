export interface BudgetLineExecution {
  budgetLineId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  plannedAmount: string;
  actualAmount: string;
  deviationAmount: string;
  deviationPercent: string;
}
