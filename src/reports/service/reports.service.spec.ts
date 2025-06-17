import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import fs from 'fs';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();

    service = module.get<ReportsService>(ReportsService);

    // Reset all mocks
    jest.clearAllMocks();
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
    it('should update state to starting then finished', () => {
      // Mock file system
      mockedFs.readdirSync.mockReturnValue(['test.csv'] as never);
      mockedFs.readFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockedFs.writeFileSync.mockImplementation(() => {});

      service.accounts();

      expect(service.state('accounts')).toMatch(/finished in \d+\.\d+/);
    });

    it('should handle errors by throwing File system error', () => {
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => service.accounts()).toThrow('File system error');
    });
  });

  describe('yearly', () => {
    it('should update state to starting then finished', () => {
      mockedFs.readdirSync.mockReturnValue(['test.csv'] as never);
      mockedFs.readFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockedFs.writeFileSync.mockImplementation(() => {});

      service.yearly();

      expect(service.state('yearly')).toMatch(/finished in \d+\.\d+/);
    });

    it('should handle errors by throwing File system error', () => {
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => service.yearly()).toThrow('File system error');
    });
  });

  describe('fs', () => {
    it('should update state to starting then finished', () => {
      mockedFs.readdirSync.mockReturnValue(['test.csv'] as never);
      mockedFs.readFileSync.mockReturnValue('2023-01-01,Cash,,100,0\n');
      mockedFs.writeFileSync.mockImplementation(() => {});

      service.fs();

      expect(service.state('fs')).toMatch(/finished in \d+\.\d+/);
    });

    it('should handle errors by throwing File system error', () => {
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      expect(() => service.fs()).toThrow('File system error');
    });
  });
});
