import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import fs from 'fs';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

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
      mockedFs.readdirSync.mockReturnValue(['test.csv'] as never);
      mockedFs.readFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockedFs.statSync.mockReturnValue({ mtimeMs: 123456789 } as never);
      mockedFs.writeFileSync.mockImplementation(() => {});

      service.accounts();

      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+s/);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        'out/accounts.csv',
        expect.stringContaining('Account,Balance'),
      );
    });

    it('should handle errors in processing', () => {
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      service.accounts();

      expect(service.state('accounts')).toBe('failed: File system error');
    });
  });

  describe('yearly', () => {
    it('should process yearly reports and update state', () => {
      mockedFs.readdirSync.mockReturnValue(['test.csv'] as never);
      mockedFs.readFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockedFs.statSync.mockReturnValue({ mtimeMs: 123456789 } as never);
      mockedFs.writeFileSync.mockImplementation(() => {});

      service.yearly();

      expect(service.state('yearly')).toMatch(/finished in \d+\.\d+s/);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        'out/yearly.csv',
        expect.stringContaining('Financial Year,Cash Balance'),
      );
    });

    it('should handle errors in processing', () => {
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      service.yearly();

      expect(service.state('yearly')).toBe('failed: File system error');
    });
  });

  describe('fs', () => {
    it('should process financial statements and update state', () => {
      mockedFs.readdirSync.mockReturnValue(['test.csv'] as never);
      mockedFs.readFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockedFs.statSync.mockReturnValue({ mtimeMs: 123456789 } as never);
      mockedFs.writeFileSync.mockImplementation(() => {});

      service.fs();

      expect(service.state('fs')).toMatch(/finished in \d+\.\d+s/);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        'out/fs.csv',
        expect.stringContaining('Basic Financial Statement'),
      );
    });

    it('should handle errors in processing', () => {
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      service.fs();

      expect(service.state('fs')).toBe('failed: File system error');
    });
  });
});
