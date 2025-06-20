import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import readline from 'readline';

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

  private async getCsvFiles(excludeFiles: string[] = []): Promise<string[]> {
    const tmpDir = 'tmp';
    const files = await fs.promises.readdir(tmpDir);
    return files.filter(
      (file) => file.endsWith('.csv') && !excludeFiles.includes(file),
    );
  }

  private async processData(
    lineProcessor: (line: ParsedLine) => void,
    excludeFiles?: string[],
  ): Promise<void> {
    const csvFiles = await this.getCsvFiles(excludeFiles);
    const tmpDir = 'tmp';

    for (const file of csvFiles) {
      const filePath = path.join(tmpDir, file);
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (line.trim()) {
          const parsedLine = this.parseCsvLine(line);
          lineProcessor(parsedLine);
        }
      }
    }
  }

  private async getCurrentFileStats(): Promise<Map<string, number>> {
    const tmpDir = 'tmp';
    const fileStats = new Map<string, number>();
    const files = await fs.promises.readdir(tmpDir);
    const allCsvFiles = files.filter((file) => file.endsWith('.csv'));

    for (const file of allCsvFiles) {
      const filePath = path.join(tmpDir, file);
      const stats = await fs.promises.stat(filePath);
      fileStats.set(file, stats.mtimeMs);
    }

    return fileStats;
  }

  async accounts(): Promise<void> {
    this.states.accounts = 'starting';
    const start = performance.now();

    const currentFileStats = await this.getCurrentFileStats();
    const cacheData = this.caches.accounts;

    // Check if we can use cached result
    if (cacheData?.result && this.isCacheValid(cacheData, currentFileStats)) {
      await this.generateAccountsOutput(cacheData.result, start);
      return;
    }

    const accountBalances = new Map<string, number>();

    // Process CSV files directly
    await this.processData(({ account, debit, credit }) => {
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

    await this.generateAccountsOutput(accountBalances, start);
  }

  async yearly(): Promise<void> {
    this.states.yearly = 'starting';
    const start = performance.now();

    const excludeFiles = ['yearly.csv'];
    const currentFileStats = await this.getCurrentFileStats();
    const cacheData = this.caches.yearly;

    // Check if we can use cached result
    if (
      cacheData?.result &&
      this.isCacheValid(cacheData, currentFileStats, excludeFiles)
    ) {
      await this.generateYearlyOutput(cacheData.result, start);
      return;
    }

    const cashByYear = new Map<number, number>();

    // Process only Cash transactions
    await this.processData(({ date, account, debit, credit }) => {
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

    await this.generateYearlyOutput(cashByYear, start);
  }

  async fs(): Promise<void> {
    this.states.fs = 'starting';
    const start = performance.now();

    const excludeFiles = ['fs.csv'];
    const currentFileStats = await this.getCurrentFileStats();
    const cacheData = this.caches.fs;
    // Check if we can use cached result
    if (
      cacheData?.result &&
      this.isCacheValid(cacheData, currentFileStats, excludeFiles)
    ) {
      await this.generateFsOutput(cacheData?.result, start);
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

    await this.processData(({ account, debit, credit }) => {
      if (relevantAccounts.has(account)) {
        const balance = balances.get(account) || 0;
        balances.set(account, balance + debit - credit);
      }
    }, excludeFiles);

    this.caches.fs = {
      result: balances,
      fileStats: currentFileStats,
    };

    await this.generateFsOutput(balances, start);
  }

  private async generateAccountsOutput(
    accountBalances: AccountBalances,
    start: number,
  ): Promise<void> {
    const writeStream = fs.createWriteStream('out/accounts.csv');
    writeStream.write('Account,Balance\n');

    for (const [account, balance] of accountBalances) {
      writeStream.write(`${account},${balance.toFixed(2)}\n`);
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    this.states.accounts = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  private async generateYearlyOutput(
    cashByYear: CashByYear,
    start: number,
  ): Promise<void> {
    const writeStream = fs.createWriteStream('out/yearly.csv');
    writeStream.write('Financial Year,Cash Balance\n');

    const sortedEntries = Array.from(cashByYear.entries()).sort(
      ([a], [b]) => a - b,
    );
    for (const [year, balance] of sortedEntries) {
      writeStream.write(`${year},${balance.toFixed(2)}\n`);
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    this.states.yearly = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }

  private async generateFsOutput(
    balances: FSBalances,
    start: number,
  ): Promise<void> {
    const writeStream = fs.createWriteStream('out/fs.csv');

    writeStream.write('Basic Financial Statement\n');
    writeStream.write('\n');
    writeStream.write('Income Statement\n');

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const account of this.fsCategories['Income Statement']['Revenues']) {
      const value = balances.get(account) || 0;
      writeStream.write(`${account},${value.toFixed(2)}\n`);
      totalRevenue += value;
    }

    for (const account of this.fsCategories['Income Statement']['Expenses']) {
      const value = balances.get(account) || 0;
      writeStream.write(`${account},${value.toFixed(2)}\n`);
      totalExpenses += value;
    }

    writeStream.write(
      `Net Income,${(totalRevenue - totalExpenses).toFixed(2)}\n`,
    );
    writeStream.write('\n');
    writeStream.write('Balance Sheet\n');

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    writeStream.write('Assets\n');
    for (const account of this.fsCategories['Balance Sheet']['Assets']) {
      const value = balances.get(account) || 0;
      writeStream.write(`${account},${value.toFixed(2)}\n`);
      totalAssets += value;
    }
    writeStream.write(`Total Assets,${totalAssets.toFixed(2)}\n`);
    writeStream.write('\n');

    writeStream.write('Liabilities\n');
    for (const account of this.fsCategories['Balance Sheet']['Liabilities']) {
      const value = balances.get(account) || 0;
      writeStream.write(`${account},${value.toFixed(2)}\n`);
      totalLiabilities += value;
    }
    writeStream.write(`Total Liabilities,${totalLiabilities.toFixed(2)}\n`);
    writeStream.write('\n');

    writeStream.write('Equity\n');
    for (const account of this.fsCategories['Balance Sheet']['Equity']) {
      const value = balances.get(account) || 0;
      writeStream.write(`${account},${value.toFixed(2)}\n`);
      totalEquity += value;
    }

    writeStream.write(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}\n`,
    );
    totalEquity += totalRevenue - totalExpenses;
    writeStream.write(`Total Equity,${totalEquity.toFixed(2)}\n`);
    writeStream.write('\n');
    writeStream.write(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}\n`,
    );

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    this.states.fs = `finished in ${((performance.now() - start) / 1000).toFixed(2)}`;
  }
}
