export interface PostingLineInput {
  accountId: string;
  debit: string; // '0.00' when this line is a credit
  credit: string; // '0.00' when this line is a debit
  currency: string;
  exchangeRate: string; // to base currency, as of the posting date
  counterpartyId?: string | null;
  contractId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  description?: string | null;
}

export interface PostEntryInput {
  date: string; // ISO date; resolves the financial period
  description: string;
  sourceType: string;
  sourceId?: string | null;
  createdByUserId: string;
  lines: PostingLineInput[];
}
