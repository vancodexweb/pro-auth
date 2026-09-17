import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccountType } from '../accounting/enums/account-type.enum';
import { subtractDecimal } from '../../common/utils/decimal.util';
import {
  AccountBalanceRow,
  CashFlowResult,
  CounterpartyBalanceRow,
  ProfitAndLossResult,
} from './analytics.types';

/**
 * Every method here aggregates in SQL and returns bounded, pre-summed
 * rows - never "load every journal line into Node and reduce()". That is
 * the difference between a report that stays fast at 10 postings and one
 * that stays fast at 10 million.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async profitAndLoss(from: string, to: string): Promise<ProfitAndLossResult> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('a.type', 'type')
      .addSelect('COALESCE(SUM(l.debit), 0)', 'totalDebit')
      .addSelect('COALESCE(SUM(l.credit), 0)', 'totalCredit')
      .from('journal_lines', 'l')
      .innerJoin('journal_entries', 'e', 'e.id = l."journalEntryId"')
      .innerJoin('accounts', 'a', 'a.id = l."accountId"')
      .where('e.date BETWEEN :from AND :to', { from, to })
      .andWhere('a.type IN (:...types)', { types: [AccountType.INCOME, AccountType.EXPENSE] })
      .groupBy('a.type')
      .getRawMany<{ type: AccountType; totalDebit: string; totalCredit: string }>();

    const income = rows.find((r) => r.type === AccountType.INCOME);
    const expense = rows.find((r) => r.type === AccountType.EXPENSE);

    // Income accounts grow on the credit side; expense accounts grow on the debit side.
    const totalIncome = income ? subtractDecimal(income.totalCredit, income.totalDebit) : '0.00';
    const totalExpense = expense
      ? subtractDecimal(expense.totalDebit, expense.totalCredit)
      : '0.00';

    return {
      from,
      to,
      totalIncome,
      totalExpense,
      netProfit: subtractDecimal(totalIncome, totalExpense),
    };
  }

  async cashFlow(from: string, to: string): Promise<CashFlowResult> {
    const raw = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(l.debit), 0)', 'totalDebit')
      .addSelect('COALESCE(SUM(l.credit), 0)', 'totalCredit')
      .from('journal_lines', 'l')
      .innerJoin('journal_entries', 'e', 'e.id = l."journalEntryId"')
      .innerJoin('accounts', 'a', 'a.id = l."accountId"')
      .where('e.date BETWEEN :from AND :to', { from, to })
      .andWhere('a."isCash" = true')
      .getRawOne<{ totalDebit: string; totalCredit: string }>();

    const totalInflow = raw?.totalDebit ?? '0.00';
    const totalOutflow = raw?.totalCredit ?? '0.00';
    return {
      from,
      to,
      totalInflow,
      totalOutflow,
      netCashFlow: subtractDecimal(totalInflow, totalOutflow),
    };
  }

  /** Оборотно-сальдовая ведомость: turnover and balance per account for a date range. */
  async trialBalance(from: string, to: string): Promise<AccountBalanceRow[]> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('a.id', 'accountId')
      .addSelect('a.code', 'accountCode')
      .addSelect('a.name', 'accountName')
      .addSelect('a.type', 'accountType')
      .addSelect('COALESCE(SUM(l.debit), 0)', 'debitTurnover')
      .addSelect('COALESCE(SUM(l.credit), 0)', 'creditTurnover')
      .from('accounts', 'a')
      .leftJoin(
        'journal_lines',
        'l',
        'l."accountId" = a.id AND l."journalEntryId" IN ' +
          '(SELECT id FROM journal_entries WHERE date BETWEEN :from AND :to)',
      )
      .setParameter('from', from)
      .setParameter('to', to)
      .groupBy('a.id')
      .orderBy('a.code', 'ASC')
      .getRawMany<{
        accountId: string;
        accountCode: string;
        accountName: string;
        accountType: AccountType;
        debitTurnover: string;
        creditTurnover: string;
      }>();

    return rows.map((row) => ({
      ...row,
      balance:
        row.accountType === AccountType.ASSET || row.accountType === AccountType.EXPENSE
          ? subtractDecimal(row.debitTurnover, row.creditTurnover)
          : subtractDecimal(row.creditTurnover, row.debitTurnover),
    }));
  }

  /** Per-counterparty, per-account balances - the receivables/payables report. */
  async counterpartyBalances(
    asOfDate: string,
    counterpartyId?: string,
  ): Promise<CounterpartyBalanceRow[]> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('l."counterpartyId"', 'counterpartyId')
      .addSelect('a.id', 'accountId')
      .addSelect('a.code', 'accountCode')
      .addSelect('a.name', 'accountName')
      .addSelect('COALESCE(SUM(l.debit), 0)', 'debitTurnover')
      .addSelect('COALESCE(SUM(l.credit), 0)', 'creditTurnover')
      .from('journal_lines', 'l')
      .innerJoin('journal_entries', 'e', 'e.id = l."journalEntryId"')
      .innerJoin('accounts', 'a', 'a.id = l."accountId"')
      .where('l."counterpartyId" IS NOT NULL')
      .andWhere('e.date <= :asOfDate', { asOfDate })
      .groupBy('l."counterpartyId", a.id')
      .orderBy('a.code', 'ASC');

    if (counterpartyId) {
      qb.andWhere('l."counterpartyId" = :counterpartyId', { counterpartyId });
    }

    const rows = await qb.getRawMany<{
      counterpartyId: string;
      accountId: string;
      accountCode: string;
      accountName: string;
      debitTurnover: string;
      creditTurnover: string;
    }>();

    return rows.map((row) => ({
      ...row,
      balance: subtractDecimal(row.debitTurnover, row.creditTurnover),
    }));
  }

  /** Account balances as of a given date (for a balance-sheet style view). */
  async accountBalances(asOfDate: string): Promise<AccountBalanceRow[]> {
    return this.trialBalance('0001-01-01', asOfDate);
  }
}
