import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from '../service/reports.service';

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
    it('should call all report generation methods and return success message', () => {
      const accountsSpy = jest.spyOn(service, 'accounts');
      const yearlySpy = jest.spyOn(service, 'yearly');
      const fsSpy = jest.spyOn(service, 'fs');

      const result = controller.generate();

      expect(accountsSpy).toHaveBeenCalledWith();
      expect(yearlySpy).toHaveBeenCalledWith();
      expect(fsSpy).toHaveBeenCalledWith();
      expect(result).toEqual({ message: 'finished' });
    });

    it('should handle service errors gracefully', () => {
      const accountsSpy = jest
        .spyOn(service, 'accounts')
        .mockImplementation(() => {
          throw new Error('Service error');
        });

      expect(() => controller.generate()).toThrow('Service error');
      expect(accountsSpy).toHaveBeenCalled();
    });
  });
});
