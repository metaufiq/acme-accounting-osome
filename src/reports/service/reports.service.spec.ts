import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import fs from 'fs';

// Mock fs module
jest.mock('fs');

interface MockStats {
  mtimeMs: number;
}

// Create properly typed mocks
const mockReaddirSync = jest.fn<string[], [string]>();
const mockReadFileSync = jest.fn<string, [string, string]>();
const mockStatSync = jest.fn<MockStats, [string]>();
const mockWriteFileSync = jest.fn<void, [string, string]>();

// Override fs methods with our typed mocks
(fs.readdirSync as jest.Mock) = mockReaddirSync;
(fs.readFileSync as jest.Mock) = mockReadFileSync;
(fs.statSync as jest.Mock) = mockStatSync;
(fs.writeFileSync as jest.Mock) = mockWriteFileSync;

describe('ReportsService', () => {
  let service: ReportsService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('state', () => {
    it('should return idle state initially', () => {
      expect(service.state('accounts')).toBe('idle');
      expect(service.state('yearly')).toBe('idle');
      expect(service.state('fs')).toBe('idle');
    });
  });

  describe('accounts', () => {
    it('should process accounts and update state', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      service.accounts();

      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+s/);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/accounts.csv',
        expect.stringContaining('Account,Balance'),
      );
    });

    it('should handle errors in processing', () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      service.accounts();

      expect(service.state('accounts')).toBe('failed: File system error');
    });
  });

  describe('yearly', () => {
    it('should process yearly reports and update state', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      service.yearly();

      expect(service.state('yearly')).toMatch(/finished in \d+\.\d+s/);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/yearly.csv',
        expect.stringContaining('Financial Year,Cash Balance'),
      );
    });

    it('should handle errors in processing', () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      service.yearly();

      expect(service.state('yearly')).toBe('failed: File system error');
    });
  });

  describe('fs', () => {
    it('should process financial statements and update state', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      service.fs();

      expect(service.state('fs')).toMatch(/finished in \d+\.\d+s/);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/fs.csv',
        expect.stringContaining('Basic Financial Statement'),
      );
    });

    it('should handle errors in processing', () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      service.fs();

      expect(service.state('fs')).toBe('failed: File system error');
    });
  });

  describe('caching functionality', () => {
    beforeEach(() => {
      // Reset service cache by creating new instance
      service = module.get<ReportsService>(ReportsService);
    });

    it('should cache processed data on first run', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call should process files
      service.accounts();

      // Reset mock call counts
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call should use cache (no readFileSync calls)
      service.accounts();

      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockReaddirSync).toHaveBeenCalled(); // Still checks directory
      expect(mockStatSync).toHaveBeenCalled(); // Still checks file stats
    });

    it('should invalidate cache when file is modified', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call
      service.accounts();

      // Reset and change file modification time
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 999999999 }); // Different mtime
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,200,0\n');

      // Second call should reprocess due to changed mtime
      service.accounts();

      expect(mockReadFileSync).toHaveBeenCalled(); // Should read file again
    });

    it('should invalidate cache when file count changes', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call
      service.accounts();

      // Reset and add new file
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['test.csv', 'test2.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');

      // Second call should reprocess due to file count change
      service.accounts();

      expect(mockReadFileSync).toHaveBeenCalled(); // Should read files again
    });
  });

  describe('file filtering', () => {
    beforeEach(() => {
      mockWriteFileSync.mockImplementation(() => {});
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
    });

    it('should process all CSV files for accounts', () => {
      mockReaddirSync.mockReturnValue([
        'data.csv',
        'yearly.csv',
        'fs.csv',
        'accounts.csv',
        'other.txt',
      ]);

      service.accounts();

      // Should process only CSV files, no exclusions for accounts
      expect(mockReadFileSync).toHaveBeenCalledTimes(4); // All CSV files
    });

    it('should exclude yearly.csv when processing yearly report', () => {
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);

      service.yearly();

      // Should process only data.csv and fs.csv (excluding yearly.csv)
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    it('should exclude fs.csv when processing financial statements', () => {
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);

      service.fs();

      // Should process only data.csv and yearly.csv (excluding fs.csv)
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });
  });
});
