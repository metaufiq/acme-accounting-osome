/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import fs from 'fs';
import readline from 'readline';
import { Stats, WriteStream, ReadStream } from 'fs';
import { Interface } from 'readline';

import { ReportsService } from './reports.service';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
  },
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
}));
jest.mock('readline', () => ({
  createInterface: jest.fn(),
}));

// Create mock implementations that satisfy TypeScript interfaces

const createMockStats = (mtimeMs: number): Stats =>
  //@ts-expect-error only for mock
  ({
    mtimeMs,
  });

const createMockWriteStream = (): WriteStream =>
  //@ts-expect-error only for mock
  ({
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
    on: jest.fn().mockImplementation((event: string, callback: () => void) => {
      if (event === 'finish') {
        // Simulate immediate finish
        setTimeout(callback, 0);
      }
      return {};
    }),
  });

const createMockReadStream = (): ReadStream => ({}) as ReadStream;

const createMockReadInterface = (lines: string[]): Interface =>
  //@ts-expect-error only for mock
  ({
    [Symbol.asyncIterator]: async function* () {
      await Promise.resolve(); // Add await to satisfy ESLint
      for (const line of lines) {
        yield line;
      }
    },
  });

describe('ReportsService', () => {
  let service: ReportsService;
  let module: TestingModule;

  const mockReaddir = fs.promises.readdir as jest.MockedFunction<
    typeof fs.promises.readdir
  >;
  const mockStat = fs.promises.stat as jest.MockedFunction<
    typeof fs.promises.stat
  >;
  const mockCreateReadStream = fs.createReadStream as jest.MockedFunction<
    typeof fs.createReadStream
  >;
  const mockCreateWriteStream = fs.createWriteStream as jest.MockedFunction<
    typeof fs.createWriteStream
  >;
  const mockCreateInterface = readline.createInterface as jest.MockedFunction<
    typeof readline.createInterface
  >;

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
    it('should process accounts and update state', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue(['test.csv']);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      await service.accounts();

      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+/);
      expect(mockStream.write).toHaveBeenCalledWith('Account,Balance\n');
    });
  });

  describe('yearly', () => {
    it('should process yearly reports and update state', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue(['test.csv']);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      await service.yearly();

      expect(service.state('yearly')).toMatch(/finished in \d+\.\d+/);
      expect(mockStream.write).toHaveBeenCalledWith(
        'Financial Year,Cash Balance\n',
      );
    });
  });

  describe('fs', () => {
    it('should process financial statements and update state', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue(['test.csv']);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      await service.fs();

      expect(service.state('fs')).toMatch(/finished in \d+\.\d+/);
      expect(mockStream.write).toHaveBeenCalledWith(
        'Basic Financial Statement\n',
      );
    });
  });

  describe('caching functionality', () => {
    beforeEach(() => {
      // Reset service cache by creating new instance
      service = module.get<ReportsService>(ReportsService);
    });

    it('should cache processed data on first run', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue(['test.csv']);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      // First call should process files
      await service.accounts();
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);

      // Reset mock call counts
      jest.clearAllMocks();
      (mockReaddir as jest.Mock).mockResolvedValue(['test.csv']);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);

      // Second call should use cache (no file processing)
      await service.accounts();

      expect(mockCreateInterface).not.toHaveBeenCalled();
      expect(mockReaddir).toHaveBeenCalled(); // Still checks directory
      expect(mockStat).toHaveBeenCalled(); // Still checks file stats
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);
    });

    it('should invalidate cache when relevant files are modified', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue(['test.csv']);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      // First call
      await service.accounts();

      // Reset and change file modification time
      jest.clearAllMocks();
      (mockReaddir as jest.Mock).mockResolvedValue(['test.csv']);
      mockStat.mockResolvedValue(createMockStats(999999999)); // Different mtime
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,200,0']),
      );

      // Second call should reprocess due to changed mtime
      await service.accounts();

      expect(mockCreateInterface).toHaveBeenCalled(); // Should read file again
    });

    it('should maintain separate caches for different report types', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue([
        'data.csv',
        'yearly.csv',
        'fs.csv',
      ]);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      // First call - accounts function (no exclusions)
      await service.accounts();
      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+$/);

      // Reset mock call counts
      jest.clearAllMocks();
      (mockReaddir as jest.Mock).mockResolvedValue([
        'data.csv',
        'yearly.csv',
        'fs.csv',
      ]);
      mockStat.mockResolvedValue(createMockStats(123456789));
      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      // Second call - yearly function (excludes yearly.csv)
      // This should not use accounts cache since it's a different report type
      await service.yearly();

      expect(mockCreateInterface).toHaveBeenCalled(); // Should read files for yearly cache
      expect(mockReaddir).toHaveBeenCalled(); // Still checks directory
      expect(mockStat).toHaveBeenCalled(); // Still checks file stats
      expect(service.state('yearly')).toMatch(/finished in \d+\.\d+$/);
    });

    it('should NOT invalidate cache when only excluded files are modified', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue([
        'data.csv',
        'yearly.csv',
        'fs.csv',
      ]);
      mockStat
        .mockResolvedValueOnce(createMockStats(123456789)) // data.csv - initial
        .mockResolvedValueOnce(createMockStats(123456789)) // yearly.csv - initial
        .mockResolvedValueOnce(createMockStats(123456789)) // fs.csv - initial
        .mockResolvedValueOnce(createMockStats(123456789)) // data.csv - second call
        .mockResolvedValueOnce(createMockStats(123456789)) // yearly.csv - second call
        .mockResolvedValueOnce(createMockStats(999999999)); // fs.csv - CHANGED but excluded

      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      // First call to fs() - excludes fs.csv, builds cache
      await service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      (mockReaddir as jest.Mock).mockResolvedValue([
        'data.csv',
        'yearly.csv',
        'fs.csv',
      ]);

      // Second call to fs() - fs.csv is modified but excluded, should use cache
      await service.fs();

      expect(mockCreateInterface).not.toHaveBeenCalled(); // Should NOT read files again
    });

    it('should invalidate cache when non-excluded files are modified', async () => {
      const mockStream = createMockWriteStream();

      (mockReaddir as jest.Mock).mockResolvedValue([
        'data.csv',
        'yearly.csv',
        'fs.csv',
      ]);
      mockStat
        .mockResolvedValueOnce(createMockStats(123456789)) // data.csv - initial
        .mockResolvedValueOnce(createMockStats(123456789)) // yearly.csv - initial
        .mockResolvedValueOnce(createMockStats(123456789)) // fs.csv - initial
        .mockResolvedValueOnce(createMockStats(999999999)) // data.csv - CHANGED (non-excluded)
        .mockResolvedValueOnce(createMockStats(123456789)) // yearly.csv - second call
        .mockResolvedValueOnce(createMockStats(123456789)); // fs.csv - second call

      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      // First call to fs() - excludes fs.csv, builds cache
      await service.fs();

      // Reset mock call counts
      jest.clearAllMocks();
      (mockReaddir as jest.Mock).mockResolvedValue([
        'data.csv',
        'yearly.csv',
        'fs.csv',
      ]);

      // Second call to fs() - data.csv is modified and NOT excluded, should invalidate cache
      await service.fs();

      expect(mockCreateInterface).toHaveBeenCalled(); // Should read files again
    });
  });

  describe('file filtering', () => {
    beforeEach(() => {
      const mockStream = createMockWriteStream();

      mockCreateWriteStream.mockReturnValue(mockStream);
      mockCreateReadStream.mockReturnValue(createMockReadStream());
      mockStat.mockResolvedValue(createMockStats(123456789));
    });

    it('should process all CSV files for accounts', async () => {
      const csvFileNames = ['data.csv', 'yearly.csv', 'fs.csv', 'accounts.csv'];
      const fileNames = [...csvFileNames, 'other.txt'];

      (mockReaddir as jest.Mock).mockResolvedValue(fileNames);
      mockCreateInterface.mockReturnValue(
        createMockReadInterface(['2023-01-01,Cash,,100,0']),
      );

      await service.accounts();

      // Should process only CSV files, no exclusions for accounts
      expect(mockCreateInterface).toHaveBeenCalledTimes(csvFileNames.length); // All CSV files
    });

    it('should exclude yearly.csv when processing yearly report', async () => {
      const fileNames = ['data.csv', 'yearly.csv', 'fs.csv'];
      (mockReaddir as jest.Mock).mockResolvedValue(fileNames);

      // Mock different content for each file to verify exclusion
      mockCreateInterface
        .mockReturnValueOnce(
          createMockReadInterface(['2023-01-01,Cash,,100,0']),
        ) // data.csv
        .mockReturnValueOnce(
          createMockReadInterface(['2023-01-01,Cash,,300,0']),
        ); // fs.csv (yearly.csv should be excluded)

      await service.yearly();

      // Should process 2 files (data.csv and fs.csv), excluding yearly.csv
      expect(mockCreateInterface).toHaveBeenCalledTimes(2);
    });

    it('should exclude fs.csv when processing financial statements', async () => {
      const fileNames = ['data.csv', 'yearly.csv', 'fs.csv'];
      (mockReaddir as jest.Mock).mockResolvedValue(fileNames);

      // Mock different content for each file to verify exclusion
      mockCreateInterface
        .mockReturnValueOnce(
          createMockReadInterface(['2023-01-01,Cash,,100,0']),
        ) // data.csv
        .mockReturnValueOnce(
          createMockReadInterface(['2023-01-01,Sales Revenue,,200,0']),
        ); // yearly.csv (fs.csv should be excluded)

      await service.fs();

      // Should process 2 files (data.csv and yearly.csv), excluding fs.csv
      expect(mockCreateInterface).toHaveBeenCalledTimes(2);
    });
  });
});
