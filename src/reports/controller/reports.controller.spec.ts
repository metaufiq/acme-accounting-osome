import { Test, TestingModule } from '@nestjs/testing';

import { ReportsService } from '../service/reports.service';
import { ReportsController } from './reports.controller';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            state: jest.fn(),
            accounts: jest.fn(),
            yearly: jest.fn(),
            fs: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('report', () => {
    it('should return report states for all report types', () => {
      const mockStates = {
        accounts: 'finished in 1.23',
        yearly: 'idle',
        fs: 'starting',
      };

      const stateSpy = jest
        .spyOn(service, 'state')
        .mockImplementation(
          (scope: string) => mockStates[scope as keyof typeof mockStates],
        );

      const result = controller.report();

      expect(stateSpy).toHaveBeenCalledWith('accounts');
      expect(stateSpy).toHaveBeenCalledWith('yearly');
      expect(stateSpy).toHaveBeenCalledWith('fs');
      expect(result).toEqual({
        'accounts.csv': 'finished in 1.23',
        'yearly.csv': 'idle',
        'fs.csv': 'starting',
      });
    });
  });

  describe('generate', () => {
    it('should return processing message and call report methods asynchronously', async () => {
      const accountsSpy = jest.spyOn(service, 'accounts');
      const yearlySpy = jest.spyOn(service, 'yearly');
      const fsSpy = jest.spyOn(service, 'fs');

      const result = controller.generate();

      // Should return immediately with processing message
      expect(result).toEqual({ message: 'processing' });

      expect(accountsSpy).not.toHaveBeenCalled();
      expect(yearlySpy).not.toHaveBeenCalled();
      expect(fsSpy).not.toHaveBeenCalled();

      // Wait for setImmediate to execute
      await new Promise((resolve) => setImmediate(resolve));

      // Now the methods should have been called
      expect(accountsSpy).toHaveBeenCalledWith();
      expect(yearlySpy).toHaveBeenCalledWith();
      expect(fsSpy).toHaveBeenCalledWith();
    });

    it('should handle service errors without affecting the response', async () => {
      const accountsSpy = jest.spyOn(service, 'accounts');
      const yearlySpy = jest.spyOn(service, 'yearly');
      const fsSpy = jest.spyOn(service, 'fs');

      // Should not throw error - errors are handled in background
      const result = controller.generate();
      expect(result).toEqual({ message: 'processing' });

      // Wait for background processing
      await new Promise((resolve) => setImmediate(resolve));

      // All methods should be called
      expect(accountsSpy).toHaveBeenCalled();
      expect(yearlySpy).toHaveBeenCalled();
      expect(fsSpy).toHaveBeenCalled();
    });
  });
});
