import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface CacheEntry<T> {
  result: T;
  fileStats: Map<string, number>;
}

type AccountBalances = Map<string, number>;
type CashByYear = Map<number, number>;
type FSBalances = Map<string, number>;

interface CacheData {
  accounts: CacheEntry<AccountBalances> | null;
  yearly: CacheEntry<CashByYear> | null;
  fs: CacheEntry<FSBalances> | null;
}

interface ParsedLine {
  date: string;
  account: string;
  debit: number;
  credit: number;
}

@Injectable()
export class ReportsService {
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  private caches: CacheData = {
    accounts: null,
    yearly: null,
    fs: null,
  };

  private readonly fsCategories = {
    'Income Statement': {
      Revenues: ['Sales Revenue'],
      Expenses: [
        'Cost of Goods Sold',
        'Salaries Expense',
        'Rent Expense',
        'Utilities Expense',
        'Interest Expense',
        'Tax Expense',
      ],
    },
    'Balance Sheet': {
      Assets: [
        'Cash',
        'Accounts Receivable',
        'Inventory',
        'Fixed Assets',
        'Prepaid Expenses',
      ],
      Liabilities: [
        'Accounts Payable',
        'Loan Payable',
        'Sales Tax Payable',
        'Accrued Liabilities',
        'Unearned Revenue',
        'Dividends Payable',
      ],
      Equity: ['Common Stock', 'Retained Earnings'],
    },
  };

  state(scope: keyof typeof this.states): string {
    return this.states[scope];
  }

  private isCacheValid<T>(
    cacheEntry: CacheEntry<T> | null,
    currentFileStats: Map<string, number>,
    excludeFiles?: string[],
  ): boolean {
    if (!cacheEntry) return false;

    // Check if relevant files (non-excluded) have changed
    for (const [file, currentMtime] of currentFileStats) {
      if (!excludeFiles?.includes(file)) {
        const cachedMtime = cacheEntry.fileStats.get(file);
        if (!cachedMtime || cachedMtime !== currentMtime) {
          return false;
        }
      }
    }

    // Check if relevant files were removed
    for (const [file] of cacheEntry.fileStats) {
      if (!excludeFiles?.includes(file) && !currentFileStats.has(file)) {
        return false;
      }
    }

    return true;
  }

  private parseCsvLine(line: string): ParsedLine {
    const [date, account, , debit, credit] = line.split(',');
    return {
      date: date || '',
      account: account || '',
      debit: parseFloat(String(debit || 0)),
      credit: parseFloat(String(credit || 0)),
    };
  }

  private getCsvFiles(excludeFiles: string[] = []): string[] {
    const tmpDir = 'tmp';
    return fs
      .readdirSync(tmpDir)
      .filter((file) => file.endsWith('.csv') && !excludeFiles.includes(file));
  }

  private processData(
    lineProcessor: (line: ParsedLine) => void,
    excludeFiles?: string[],
  ): void {
    const csvFiles = this.getCsvFiles(excludeFiles);
    const tmpDir = 'tmp';

    for (const file of csvFiles) {
      const filePath = path.join(tmpDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        const parsedLine = this.parseCsvLine(line);
        lineProcessor(parsedLine);
      }
    }
  }

  private getCurrentFileStats(): Map<string, number> {
    const tmpDir = 'tmp';
    const fileStats = new Map<string, number>();
    const allCsvFiles = fs
      .readdirSync(tmpDir)
      .filter((file) => file.endsWith('.csv'));

    for (const file of allCsvFiles) {
      const filePath = path.join(tmpDir, file);
      const stats = fs.statSync(filePath);
      fileStats.set(file, stats.mtimeMs);
    }

    return fileStats;
  }

  accounts(): void {
    this.states.accounts = 'starting';
    const start = performance.now();

    const currentFileStats = this.getCurrentFileStats();
    const cacheData = this.caches.accounts;

    // Check if we can use cached result
    if (cacheData?.result && this.isCacheValid(cacheData, currentFileStats)) {
      this.generateAccountsOutput(cacheData.result, start);
      return;
    }

    const accountBalances = new Map<string, number>();

    // Process CSV files directly
    this.processData(({ account, debit, credit }) => {
      if (account) {
        const balance = accountBalances.get(account) || 0;
        accountBalances.set(account, balance + debit - credit);
      }
    });

    // Cache the result
    this.caches.accounts = {
      result: accountBalances,
      fileStats: currentFileStats,
    };

    this.generateAccountsOutput(accountBalances, start);
  }

  yearly(): void {
    this.states.yearly = 'starting';
    const start = performance.now();

    const excludeFiles = ['yearly.csv'];
    const currentFileStats = this.getCurrentFileStats();
    const cacheData = this.caches.yearly;

    // Check if we can use cached result
    if (
      cacheData?.result &&
      this.isCacheValid(cacheData, currentFileStats, excludeFiles)
    ) {
      this.generateYearlyOutput(cacheData.result, start);
      return;
    }

    const cashByYear = new Map<number, number>();

    // Process only Cash transactions
    this.processData(({ date, account, debit, credit }) => {
      if (account === 'Cash' && date) {
        const year = new Date(date).getFullYear();
        if (!isNaN(year)) {
          const balance = cashByYear.get(year) || 0;
          cashByYear.set(year, balance + debit - credit);
        }
      }
    }, excludeFiles);

    this.caches.yearly = {
      result: cashByYear,
      fileStats: currentFileStats,
    };

    this.generateYearlyOutput(cashByYear, start);
  }

  fs(): void {
    this.states.fs = 'starting';
    const start = performance.now();

    const excludeFiles = ['fs.csv'];
    const currentFileStats = this.getCurrentFileStats();
    const cacheData = this.caches.fs;
    // Check if we can use cached result
    if (
      cacheData?.result &&
      this.isCacheValid(cacheData, currentFileStats, excludeFiles)
    ) {
      this.generateFsOutput(cacheData?.result, start);
      return;
    }

    // Create a Set for faster account lookup
    const relevantAccounts = new Set<string>();
    for (const section of Object.values(this.fsCategories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          relevantAccounts.add(account);
        }
      }
    }

    const balances = new Map<string, number>();

    for (const account of relevantAccounts) {
      balances.set(account, 0);
    }

    this.processData(({ account, debit, credit }) => {
      if (relevantAccounts.has(account)) {
        const balance = balances.get(account) || 0;
        balances.set(account, balance + debit - credit);
      }
    }, excludeFiles);

    this.caches.fs = {
      result: balances,
      fileStats: currentFileStats,
    };

    this.generateFsOutput(balances, start);
  }

  private generateAccountsOutput(
    accountBalances: AccountBalances,
    start: number,
  ): void {
    const output = ['Account,Balance'];
    for (const [account, balance] of accountBalances) {
      output.push(`${account},${balance.toFixed(2)}`);
    }
    fs.writeFileSync('out/accounts.csv', output.join('\n'));
    this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  private generateYearlyOutput(cashByYear: CashByYear, start: number): void {
    const output = ['Financial Year,Cash Balance'];
    Array.from(cashByYear.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([year, balance]) => {
        output.push(`${year},${balance.toFixed(2)}`);
      });
    fs.writeFileSync('out/yearly.csv', output.join('\n'));
    this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  private generateFsOutput(balances: FSBalances, start: number): void {
    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const account of this.fsCategories['Income Statement']['Revenues']) {
      const value = balances.get(account) || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    for (const account of this.fsCategories['Income Statement']['Expenses']) {
      const value = balances.get(account) || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    output.push('Assets');
    for (const account of this.fsCategories['Balance Sheet']['Assets']) {
      const value = balances.get(account) || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    output.push('Liabilities');
    for (const account of this.fsCategories['Balance Sheet']['Liabilities']) {
      const value = balances.get(account) || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    output.push('Equity');
    for (const account of this.fsCategories['Balance Sheet']['Equity']) {
      const value = balances.get(account) || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );
    fs.writeFileSync('out/fs.csv', output.join('\n'));
    this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }
}
