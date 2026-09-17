export interface ProfitAndLossResult {
  from: string;
  to: string;
  totalIncome: string;
  totalExpense: string;
  netProfit: string;
}

export interface CashFlowResult {
  from: string;
  to: string;
  totalInflow: string;
  totalOutflow: string;
  netCashFlow: string;
}

export interface AccountBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debitTurnover: string;
  creditTurnover: string;
  balance: string;
}

export interface CounterpartyBalanceRow {
  counterpartyId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debitTurnover: string;
  creditTurnover: string;
  balance: string;
}
