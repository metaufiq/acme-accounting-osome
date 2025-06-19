import { Test, TestingModule } from '@nestjs/testing';

import { Company } from '@db/models/Company';
import { TicketCategory, TicketStatus, TicketType } from '@db/models/Ticket';
import { User, UserRole } from '@db/models/User';
import { DbModule } from '@/db.module';
import { TicketsService } from './tickets.service';
import {
  UserNotFoundError,
  MultipleUsersError,
} from '@/tickets/exceptions/user-role.exception';

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketsService],
      imports: [DbModule],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    describe('managementReport', () => {
      it('creates managementReport ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await service.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple accountants, assign the last one', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const user2 = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await service.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user2.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there is no accountant, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          service.create({
            companyId: company.id,
            type: TicketType.managementReport,
          }),
        ).rejects.toEqual(new UserNotFoundError([UserRole.accountant]));
      });
    });

    describe('registrationAddressChange', () => {
      it('creates registrationAddressChange ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        const ticket = await service.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple secretaries, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        await expect(
          service.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(new MultipleUsersError(UserRole.corporateSecretary));
      });

      it('if there is no secretary, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          service.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new UserNotFoundError([
            UserRole.corporateSecretary,
            UserRole.director,
          ]),
        );
      });

      it('assigns to director when no corporate secretary exists', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await service.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(director.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('throws when multiple directors exist and no corporate secretary', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Director 1',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Director 2',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          service.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(new MultipleUsersError(UserRole.director));
      });

      it('prefers corporate secretary over director when both exist', async () => {
        const company = await Company.create({ name: 'test' });
        const corporateSecretary = await User.create({
          name: 'Corporate Secretary',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await User.create({
          name: 'Director',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await service.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(corporateSecretary.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });
    });

    describe('strikeOff', () => {
      it('creates strikeOff ticket with director', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await service.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        expect(ticket.category).toBe(TicketCategory.management);
        expect(ticket.assigneeId).toBe(director.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('throws when no director exists', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          service.create({
            companyId: company.id,
            type: TicketType.strikeOff,
          }),
        ).rejects.toEqual(new UserNotFoundError([UserRole.director]));
      });

      it('throws when multiple directors exist', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Director 1',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Director 2',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          service.create({
            companyId: company.id,
            type: TicketType.strikeOff,
          }),
        ).rejects.toEqual(new MultipleUsersError(UserRole.director));
      });

      it('resolves all other active tickets when strikeOff is created', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Accountant User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        // Create some active tickets first
        const managementTicket = await service.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        // Verify the ticket was created as open
        expect(managementTicket.status).toBe(TicketStatus.open);

        // Now create strikeOff ticket
        const strikeOffTicket = await service.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        expect(strikeOffTicket.category).toBe(TicketCategory.management);
        expect(strikeOffTicket.assigneeId).toBe(director.id);
        expect(strikeOffTicket.status).toBe(TicketStatus.open);

        // Verify all previous tickets were resolved
        const allTickets = await service.findAll();
        const companyTickets = allTickets.filter(
          (t) => t.companyId === company.id,
        );

        const managementTicketUpdated = companyTickets.find(
          (t) => t.id === managementTicket.id,
        );
        const strikeOffTicketFromDb = companyTickets.find(
          (t) => t.id === strikeOffTicket.id,
        );

        expect(managementTicketUpdated?.status).toBe(TicketStatus.resolved);
        expect(strikeOffTicketFromDb?.status).toBe(TicketStatus.open);
      });

      it('does not affect tickets from other companies', async () => {
        const company1 = await Company.create({ name: 'Company 1' });
        const company2 = await Company.create({ name: 'Company 2' });

        await User.create({
          name: 'Director 1',
          role: UserRole.director,
          companyId: company1.id,
        });
        await User.create({
          name: 'Accountant 2',
          role: UserRole.accountant,
          companyId: company2.id,
        });
        const company2Ticket = await service.create({
          companyId: company2.id,
          type: TicketType.managementReport,
        });
        await service.create({
          companyId: company1.id,
          type: TicketType.strikeOff,
        });
        const allTickets = await service.findAll();
        const company2TicketUpdated = allTickets.find(
          (t) => t.id === company2Ticket.id,
        );

        expect(company2TicketUpdated?.status).toBe(TicketStatus.open);
      });
    });
  });
});
