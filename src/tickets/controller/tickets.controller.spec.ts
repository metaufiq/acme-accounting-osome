import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from '@/tickets/service/tickets.service';
import { DbModule } from '@/db.module';
import { CreateTicketDto } from '@/tickets/dto/create-ticket.dto';
import { TicketType } from '@db/models/Ticket';
import { Company } from '@db/models/Company';
import { User, UserRole } from '@db/models/User';

describe('TicketsController', () => {
  let controller: TicketsController;
  let validationPipe: ValidationPipe;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [TicketsService],
      imports: [DbModule],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
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
    it('should return all tickets', async () => {
      const result = await controller.findAll();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a ticket with valid data', async () => {
      const company = await Company.create({ name: 'Test Company' });
      const user = await User.create({
        name: 'Test User',
        role: UserRole.accountant,
        companyId: company.id,
      });

      const createTicketDto: CreateTicketDto = {
        type: TicketType.managementReport,
        companyId: company.id,
      };

      const result = await controller.create(createTicketDto);

      expect(result).toBeDefined();
      expect(result.type).toBe(TicketType.managementReport);
      expect(result.companyId).toBe(company.id);
      expect(result.assigneeId).toBe(user.id);
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
