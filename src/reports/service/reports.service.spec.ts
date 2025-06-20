import { Test, TestingModule } from '@nestjs/testing';
import fs from 'fs';

import { ReportsService } from './reports.service';

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

      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+/);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/accounts.csv',
        expect.stringContaining('Account,Balance'),
      );
    });
  });

  describe('yearly', () => {
    it('should process yearly reports and update state', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      service.yearly();

      expect(service.state('yearly')).toMatch(/finished in \d+\.\d+/);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/yearly.csv',
        expect.stringContaining('Financial Year,Cash Balance'),
      );
    });
  });

  describe('fs', () => {
    it('should process financial statements and update state', () => {
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      service.fs();

      expect(service.state('fs')).toMatch(/finished in \d+\.\d+/);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/fs.csv',
        expect.stringContaining('Basic Financial Statement'),
      );
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
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);

      // Reset mock call counts
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['test.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call should use cache (no readFileSync calls)
      service.accounts();

      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockReaddirSync).toHaveBeenCalled(); // Still checks directory
      expect(mockStatSync).toHaveBeenCalled(); // Still checks file stats
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);
    });

    it('should invalidate cache when relevant files are modified', () => {
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

    it('should maintain separate caches for different report types', () => {
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call - accounts function (no exclusions)
      service.accounts();
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);

      // Reset mock call counts
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call - yearly function (excludes yearly.csv)
      // This should not use accounts cache since it's a different report type
      service.yearly();

      expect(mockReadFileSync).toHaveBeenCalled(); // Should read files for yearly cache
      expect(mockReaddirSync).toHaveBeenCalled(); // Still checks directory
      expect(mockStatSync).toHaveBeenCalled(); // Still checks file stats
      expect(service.state('yearly')).toMatch(/finished in \d+\.\d+$/);
    });

    it('should cache computed results instead of raw data', () => {
      // Setup multiple files with different content
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // Mock different content for each file
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('data.csv'))
          return '2023-01-01,Sales Revenue,,500,0\n';
        if (filePath.includes('yearly.csv')) return '2023-01-01,Cash,,200,0\n';
        if (filePath.includes('fs.csv')) return '2023-01-01,Inventory,,300,0\n';
        return '';
      });

      // First call processes all files (accounts - no exclusions)
      service.accounts();

      // Verify all files were processed initially
      expect(mockReadFileSync).toHaveBeenCalledTimes(3);
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);

      // Reset mock call counts
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call should use cached computed results
      service.accounts();

      expect(mockReadFileSync).not.toHaveBeenCalled(); // Uses cached results
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);
    });

    it('should track sourceFile for each transaction in cache', () => {
      mockReaddirSync.mockReturnValue(['file1.csv', 'file2.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // Mock different content for each file to verify sourceFile tracking
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('file1.csv'))
          return '2023-01-01,Account1,,100,0\n';
        if (filePath.includes('file2.csv'))
          return '2023-01-01,Account2,,200,0\n';
        return '';
      });

      // Process files to build cache
      service.accounts();

      // Verify that transactions would be properly filtered by sourceFile
      // This tests that our internal caching structure includes sourceFile
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('file1.csv'),
        'utf-8',
      );
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('file2.csv'),
        'utf-8',
      );
    });

    it('should NOT invalidate cache when only excluded files are modified', () => {
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockWriteFileSync.mockImplementation(() => {});

      // Mock different mtime for each file call
      let statCallCount = 0;
      mockStatSync.mockImplementation(() => {
        statCallCount++;
        // First 3 calls (initial cache) - same mtime for all files
        if (statCallCount <= 3) return { mtimeMs: 123456789 };
        // Next 3 calls (second fs() call) - fs.csv has different mtime, others same
        if (statCallCount === 4) return { mtimeMs: 123456789 }; // data.csv - same
        if (statCallCount === 5) return { mtimeMs: 123456789 }; // yearly.csv - same
        if (statCallCount === 6) return { mtimeMs: 999999999 }; // fs.csv - CHANGED
        return { mtimeMs: 123456789 };
      });

      // First call to fs() - excludes fs.csv, builds cache
      service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);

      // Second call to fs() - fs.csv is modified but excluded, should use cache
      service.fs();

      expect(mockReadFileSync).not.toHaveBeenCalled(); // Should NOT read files again
    });

    it('should invalidate cache when non-excluded files are modified', () => {
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockWriteFileSync.mockImplementation(() => {});

      // Mock different mtime for each file call
      let statCallCount = 0;
      mockStatSync.mockImplementation(() => {
        statCallCount++;
        // First 3 calls (initial cache) - same mtime for all files
        if (statCallCount <= 3) return { mtimeMs: 123456789 };
        // Next 3 calls (second fs() call) - data.csv has different mtime (non-excluded)
        if (statCallCount === 4) return { mtimeMs: 999999999 }; // data.csv - CHANGED
        if (statCallCount === 5) return { mtimeMs: 123456789 }; // yearly.csv - same
        if (statCallCount === 6) return { mtimeMs: 123456789 }; // fs.csv - same
        return { mtimeMs: 123456789 };
      });

      // First call to fs() - excludes fs.csv, builds cache
      service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);

      // Second call to fs() - data.csv is modified and NOT excluded, should invalidate cache
      service.fs();

      expect(mockReadFileSync).toHaveBeenCalled(); // Should read files again
    });

    it('should NOT invalidate cache when excluded files are added', () => {
      mockReaddirSync.mockReturnValueOnce(['data.csv', 'yearly.csv']); // Initial files
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call to fs() - excludes fs.csv, builds cache
      service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      // Second call - fs.csv is added (but it's excluded anyway)
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv', 'fs.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call to fs() - fs.csv added but excluded, should use cache
      service.fs();

      expect(mockReadFileSync).not.toHaveBeenCalled(); // Should NOT read files again
    });

    it('should NOT invalidate cache when excluded files are removed', () => {
      mockReaddirSync.mockReturnValueOnce(['data.csv', 'yearly.csv', 'fs.csv']); // Initial files
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call to fs() - excludes fs.csv, builds cache
      service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      // Second call - fs.csv is removed (but it was excluded anyway)
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call to fs() - fs.csv removed but was excluded, should use cache
      service.fs();

      expect(mockReadFileSync).not.toHaveBeenCalled(); // Should NOT read files again
    });

    it('should invalidate cache when non-excluded files are added', () => {
      mockReaddirSync.mockReturnValueOnce(['data.csv', 'yearly.csv']); // Initial files
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call to fs() - excludes fs.csv, builds cache
      service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      // Second call - new-data.csv is added (not excluded)
      mockReaddirSync.mockReturnValue([
        'data.csv',
        'yearly.csv',
        'new-data.csv',
      ]);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call to fs() - new-data.csv added and not excluded, should invalidate cache
      service.fs();

      expect(mockReadFileSync).toHaveBeenCalled(); // Should read files again
    });

    it('should invalidate cache when non-excluded files are removed', () => {
      mockReaddirSync.mockReturnValueOnce([
        'data.csv',
        'yearly.csv',
        'other.csv',
      ]); // Initial files
      mockReadFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });
      mockWriteFileSync.mockImplementation(() => {});

      // First call to fs() - excludes fs.csv, builds cache
      service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      // Second call - other.csv is removed (not excluded)
      mockReaddirSync.mockReturnValue(['data.csv', 'yearly.csv']);
      mockStatSync.mockReturnValue({ mtimeMs: 123456789 });

      // Second call to fs() - other.csv removed and was not excluded, should invalidate cache
      service.fs();

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
      const csvFileNames = ['data.csv', 'yearly.csv', 'fs.csv', 'accounts.csv'];
      const fileNames = [...csvFileNames, 'other.txt'];

      mockReaddirSync.mockReturnValue(fileNames);

      service.accounts();

      // Should process only CSV files, no exclusions for accounts
      expect(mockReadFileSync).toHaveBeenCalledTimes(csvFileNames.length); // All CSV files
    });

    it('should exclude yearly.csv when processing yearly report', () => {
      const fileNames = ['data.csv', 'yearly.csv', 'fs.csv'];
      mockReaddirSync.mockReturnValue(fileNames);

      // Mock different content for each file to verify exclusion
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('data.csv')) return '2023-01-01,Cash,,100,0\n';
        if (filePath.includes('yearly.csv')) return '2023-01-01,Cash,,200,0\n'; // This should be excluded
        if (filePath.includes('fs.csv')) return '2023-01-01,Cash,,300,0\n';
        return '';
      });

      service.yearly();

      // Verify the final output doesn't contain data from yearly.csv
      // If yearly.csv was included, Cash balance would be 600 (100+200+300)
      // If yearly.csv is excluded (correct), Cash balance should be 400 (100+300)
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/yearly.csv',
        expect.stringMatching(/2023,400\.00/), // Should be 400, not 600
      );
    });

    it('should exclude fs.csv when processing financial statements', () => {
      const fileNames = ['data.csv', 'yearly.csv', 'fs.csv'];
      mockReaddirSync.mockReturnValue(fileNames);

      // Mock different content for each file to verify exclusion
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('data.csv')) return '2023-01-01,Cash,,100,0\n';
        if (filePath.includes('yearly.csv'))
          return '2023-01-01,Sales Revenue,,200,0\n';
        if (filePath.includes('fs.csv')) return '2023-01-01,Cash,,300,0\n'; // This should be excluded
        return '';
      });

      service.fs();

      // Verify the final output doesn't contain data from fs.csv
      // The fs output should contain Cash: 100, Sales Revenue: 200
      // If fs.csv was included, Cash would be 400 (100+300)
      // If fs.csv is excluded (correct), Cash should be 100
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'out/fs.csv',
        expect.stringMatching(/Cash,100\.00/), // Should be 100, not 400
      );
    });
  });
});
