import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface Transaction {
  date: string;
  account: string;
  debit: number;
  credit: number;
  sourceFile: string;
}

interface ProcessedData {
  transactions: Transaction[];
  fileStats: Map<string, number>;
}

@Injectable()
export class ReportsService {
  private states = {
    accounts: 'idle',
    yearly: 'idle',
    fs: 'idle',
  };

  private cachedData: ProcessedData | null = null;

  state(scope: string): string {
    return this.states[scope as keyof typeof this.states];
  }

  private filterTransactionsByExcludedFiles(
    transactions: Transaction[],
    excludeFiles?: string[],
  ): Transaction[] {
    if (!excludeFiles || excludeFiles.length === 0) {
      return transactions;
    }
    return transactions.filter(
      (transaction) => !excludeFiles.includes(transaction.sourceFile),
    );
  }

  private loadAndProcessCsvData(excludeFiles?: string[]): Transaction[] {
    const tmpDir = 'tmp';
    const currentDataStats = new Map<string, number>();
    let cacheValid = this.cachedData !== null;

    // Get ALL CSV files for caching purposes
    const allCsvFiles = fs
      .readdirSync(tmpDir)
      .filter((file) => file.endsWith('.csv'));

    // Check if relevant file count changed (only non-excluded files matter)
    if (cacheValid) {
      const relevantFiles = allCsvFiles.filter(
        (file) => !excludeFiles || !excludeFiles.includes(file),
      );
      const cachedRelevantFiles = Array.from(
        this.cachedData!.fileStats.keys(),
      ).filter((file) => !excludeFiles || !excludeFiles.includes(file));

      if (relevantFiles.length !== cachedRelevantFiles.length) {
        cacheValid = false;
      }
    }

    // Check files for modifications
    for (const file of allCsvFiles) {
      const filePath = path.join(tmpDir, file);
      const stats = fs.statSync(filePath);
      currentDataStats.set(file, stats.mtimeMs);

      // Only check modification time for non-excluded files
      if (cacheValid && (!excludeFiles || !excludeFiles.includes(file))) {
        const cachedMtime = this.cachedData!.fileStats.get(file);
        if (!cachedMtime || cachedMtime !== stats.mtimeMs) {
          cacheValid = false;
        }
      }
    }

    // Return cached data if still valid
    if (this.cachedData && cacheValid) {
      return this.filterTransactionsByExcludedFiles(
        this.cachedData.transactions,
        excludeFiles,
      );
    }

    // Load and process ALL files (not just filtered ones for caching)
    const transactions: Transaction[] = [];

    // Process all files and track source file
    for (const file of allCsvFiles) {
      const filePath = path.join(tmpDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        const [date, account, , debit, credit] = line.split(',');
        transactions.push({
          date: date || '',
          account: account || '',
          debit: parseFloat(String(debit || 0)),
          credit: parseFloat(String(credit || 0)),
          sourceFile: file,
        });
      }
    }

    // Cache ALL processed data with ALL file stats
    this.cachedData = {
      transactions,
      fileStats: currentDataStats,
    };

    return this.filterTransactionsByExcludedFiles(transactions, excludeFiles);
  }

  accounts(): void {
    this.states.accounts = 'starting';
    const start = performance.now();

    try {
      const transactions = this.loadAndProcessCsvData();
      const outputFile = 'out/accounts.csv';
      const accountBalances = new Map<string, number>();

      // Process transactions
      for (const transaction of transactions) {
        const balance = accountBalances.get(transaction.account) || 0;
        accountBalances.set(
          transaction.account,
          balance + transaction.debit - transaction.credit,
        );
      }

      const output = ['Account,Balance'];
      for (const [account, balance] of accountBalances) {
        output.push(`${account},${balance.toFixed(2)}`);
      }
      fs.writeFileSync(outputFile, output.join('\n'));
      this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}s`;
    } catch (error) {
      this.states.accounts = `failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  yearly(): void {
    this.states.yearly = 'starting';
    const start = performance.now();

    try {
      const transactions = this.loadAndProcessCsvData(['yearly.csv']);
      const outputFile = 'out/yearly.csv';
      const cashByYear = new Map<number, number>();

      // Process only Cash transactions
      for (const transaction of transactions) {
        if (transaction.account === 'Cash' && transaction.date) {
          const year = new Date(transaction.date).getFullYear();
          if (!isNaN(year)) {
            const balance = cashByYear.get(year) || 0;
            cashByYear.set(
              year,
              balance + transaction.debit - transaction.credit,
            );
          }
        }
      }

      const output = ['Financial Year,Cash Balance'];
      // Sort years and build output
      Array.from(cashByYear.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([year, balance]) => {
          output.push(`${year},${balance.toFixed(2)}`);
        });

      fs.writeFileSync(outputFile, output.join('\n'));
      this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}s`;
    } catch (error) {
      this.states.yearly = `failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  fs(): void {
    this.states.fs = 'starting';
    const start = performance.now();

    try {
      const transactions = this.loadAndProcessCsvData(['fs.csv']);
      const outputFile = 'out/fs.csv';
      const categories = {
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

      // Create a Set for faster account lookup
      const relevantAccounts = new Set<string>();
      for (const section of Object.values(categories)) {
        for (const group of Object.values(section)) {
          for (const account of group) {
            relevantAccounts.add(account);
          }
        }
      }

      const balances = new Map<string, number>();
      // Initialize with 0 values
      for (const account of relevantAccounts) {
        balances.set(account, 0);
      }

      // Process only relevant transactions
      for (const transaction of transactions) {
        if (relevantAccounts.has(transaction.account)) {
          const balance = balances.get(transaction.account) || 0;
          balances.set(
            transaction.account,
            balance + transaction.debit - transaction.credit,
          );
        }
      }

      const output: string[] = [];
      output.push('Basic Financial Statement');
      output.push('');
      output.push('Income Statement');
      let totalRevenue = 0;
      let totalExpenses = 0;
      for (const account of categories['Income Statement']['Revenues']) {
        const value = balances.get(account) || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalRevenue += value;
      }
      for (const account of categories['Income Statement']['Expenses']) {
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
      for (const account of categories['Balance Sheet']['Assets']) {
        const value = balances.get(account) || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalAssets += value;
      }
      output.push(`Total Assets,${totalAssets.toFixed(2)}`);
      output.push('');
      output.push('Liabilities');
      for (const account of categories['Balance Sheet']['Liabilities']) {
        const value = balances.get(account) || 0;
        output.push(`${account},${value.toFixed(2)}`);
        totalLiabilities += value;
      }
      output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
      output.push('');
      output.push('Equity');
      for (const account of categories['Balance Sheet']['Equity']) {
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
      fs.writeFileSync(outputFile, output.join('\n'));
      this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}s`;
    } catch (error) {
      this.states.fs = `failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
