import { ConflictException, Injectable } from '@nestjs/common';
import { Company } from '@db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '@db/models/Ticket';
import { User, UserRole } from '@db/models/User';
import { CreateTicketDto } from '@/tickets/dto/create-ticket.dto';

export interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

interface TicketTypeHandler {
  category: TicketCategory;
  assigneeHandler: (companyId: number) => Promise<User>;
  sideEffects: Array<(companyId: number) => Promise<void>>;
}

@Injectable()
export class TicketsService {
  private throwUserNotFoundError(roles: UserRole[]): never {
    throw new ConflictException(
      `Cannot find user with role ${roles.join(' or ')} to create a ticket`,
    );
  }

  private throwMultipleUsersError(role: UserRole): never {
    throw new ConflictException(
      `Multiple users with role ${role}. Cannot create a ticket`,
    );
  }

  async findAll(): Promise<Ticket[]> {
    return await Ticket.findAll({ include: [Company, User] });
  }

  private getTicketTypeHandlers(): Record<TicketType, TicketTypeHandler> {
    return {
      [TicketType.managementReport]: {
        category: TicketCategory.accounting,
        assigneeHandler: (companyId: number) =>
          this.assignManagementReportTicket(companyId),
        sideEffects: [],
      },
      [TicketType.registrationAddressChange]: {
        category: TicketCategory.corporate,
        assigneeHandler: (companyId: number) =>
          this.assignRegistrationAddressChangeTicket(companyId),
        sideEffects: [],
      },
      [TicketType.strikeOff]: {
        category: TicketCategory.management,
        assigneeHandler: (companyId: number) =>
          this.assignStrikeOffTicket(companyId),
        sideEffects: [
          (companyId: number) => this.resolveAllActiveTickets(companyId),
        ],
      },
    };
  }

  async create(createTicketDto: CreateTicketDto) {
    const { type, companyId } = createTicketDto;
    const handlers = this.getTicketTypeHandlers();
    const handler = handlers[type];

    if (!handler) {
      throw new ConflictException(`Unsupported ticket type: ${type}`);
    }

    const assignee = await handler.assigneeHandler(companyId);

    for (const sideEffect of handler.sideEffects) {
      await sideEffect(companyId);
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category: handler.category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }

  private async assignRegistrationAddressChangeTicket(companyId: number) {
    // First try to find a corporate secretary
    const corporateSecretaries = await User.findAll({
      where: { companyId, role: UserRole.corporateSecretary },
      order: [['createdAt', 'DESC']],
    });

    if (corporateSecretaries.length > 1) {
      this.throwMultipleUsersError(UserRole.corporateSecretary);
    }

    if (corporateSecretaries.length === 1) {
      return corporateSecretaries[0];
    }

    // No corporate secretary found, try to assign to director
    const directors = await User.findAll({
      where: { companyId, role: UserRole.director },
      order: [['createdAt', 'DESC']],
    });

    if (directors.length === 0) {
      this.throwUserNotFoundError([
        UserRole.corporateSecretary,
        UserRole.director,
      ]);
    }

    if (directors.length > 1) {
      this.throwMultipleUsersError(UserRole.director);
    }

    return directors[0];
  }

  private async assignManagementReportTicket(companyId: number) {
    const assignees = await User.findAll({
      where: { companyId, role: UserRole.accountant },
      order: [['createdAt', 'DESC']],
    });

    if (!assignees.length) {
      this.throwUserNotFoundError([UserRole.accountant]);
    }

    return assignees[0];
  }

  private async assignStrikeOffTicket(companyId: number): Promise<User> {
    const directors = await User.findAll({
      where: { companyId, role: UserRole.director },
      order: [['createdAt', 'DESC']],
    });

    if (directors.length === 0) {
      this.throwUserNotFoundError([UserRole.director]);
    }

    if (directors.length > 1) {
      this.throwMultipleUsersError(UserRole.director);
    }

    return directors[0];
  }

  private async resolveAllActiveTickets(companyId: number): Promise<void> {
    await Ticket.update(
      { status: TicketStatus.resolved },
      {
        where: {
          companyId,
          status: TicketStatus.open,
        },
      },
    );
  }
}
