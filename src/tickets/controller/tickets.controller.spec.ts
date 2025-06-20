import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, BadRequestException } from '@nestjs/common';

import {
  TicketType,
  TicketStatus,
  TicketCategory,
  Ticket,
} from '@db/models/Ticket';
import { TicketsService } from '../service/tickets.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { TicketsController } from './tickets.controller';

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: TicketsService;
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    service = module.get<TicketsService>(TicketsService);
    validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll and return result', async () => {
      const mockTickets: Partial<Ticket>[] = [
        {
          id: 1,
          type: TicketType.managementReport,
          companyId: 123,
          assigneeId: 456,
          status: TicketStatus.open,
          category: TicketCategory.accounting,
        },
      ];

      const findAllSpy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(mockTickets as Ticket[]);

      const result = await controller.findAll();

      expect(findAllSpy).toHaveBeenCalledWith();
      expect(result).toEqual(mockTickets);
    });
  });

  describe('create', () => {
    it('should call service.create with correct parameters', async () => {
      const createTicketDto: CreateTicketDto = {
        type: TicketType.managementReport,
        companyId: 123,
      };

      const mockResult = {
        id: 1,
        type: TicketType.managementReport,
        companyId: 123,
        assigneeId: 456,
        status: TicketStatus.open,
        category: TicketCategory.accounting,
      };

      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValue(mockResult);

      const result = await controller.create(createTicketDto);

      expect(createSpy).toHaveBeenCalledWith(createTicketDto);
      expect(result).toEqual(mockResult);
    });

    it('should validate ticket type', async () => {
      const invalidDto = {
        type: 'invalidType',
        companyId: 1,
      };

      await expect(
        validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: CreateTicketDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept all valid ticket types', async () => {
      const validTypes = [
        TicketType.managementReport,
        TicketType.registrationAddressChange,
        TicketType.strikeOff,
      ];

      for (const ticketType of validTypes) {
        const validDto = {
          type: ticketType,
          companyId: 1,
        };

        const result = (await validationPipe.transform(validDto, {
          type: 'body',
          metatype: CreateTicketDto,
        })) as CreateTicketDto;

        expect(result.type).toBe(ticketType);
      }
    });

    it('should validate companyId is a number', async () => {
      const invalidDto = {
        type: TicketType.managementReport,
        companyId: 'notANumber',
      };

      await expect(
        validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: CreateTicketDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate companyId is positive', async () => {
      const invalidDto = {
        type: TicketType.managementReport,
        companyId: -1,
      };

      await expect(
        validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: CreateTicketDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject extra fields', async () => {
      const invalidDto = {
        type: TicketType.managementReport,
        companyId: 1,
        extraField: 'should not be allowed',
      };

      await expect(
        validationPipe.transform(invalidDto, {
          type: 'body',
          metatype: CreateTicketDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
