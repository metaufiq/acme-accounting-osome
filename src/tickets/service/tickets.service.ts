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

@Injectable()
export class TicketsService {
  async findAll(): Promise<Ticket[]> {
    return await Ticket.findAll({ include: [Company, User] });
  }

  async create(createTicketDto: CreateTicketDto) {
    const { type, companyId } = createTicketDto;

    // Check for duplicate registrationAddressChange tickets
    if (type === TicketType.registrationAddressChange) {
      const existingTicket = await Ticket.findOne({
        where: { companyId, type: TicketType.registrationAddressChange },
      });

      if (existingTicket) {
        throw new ConflictException(
          'Company already has a registrationAddressChange ticket',
        );
      }
    }

    const category =
      type === TicketType.managementReport
        ? TicketCategory.accounting
        : TicketCategory.corporate;

    let assignee: User;

    if (type === TicketType.registrationAddressChange) {
      assignee = await this.assignRegistrationAddressChangeTicket(companyId);
    } else {
      // Handle managementReport tickets
      assignee = await this.assignManagementReportTicket(companyId);
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
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
      throw new ConflictException(
        `Multiple users with role ${UserRole.corporateSecretary}. Cannot create a ticket`,
      );
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
      throw new ConflictException(
        'Cannot find user with role corporateSecretary or director to create a ticket',
      );
    }

    if (directors.length > 1) {
      throw new ConflictException(
        'Multiple users with role director. Cannot create a ticket',
      );
    }

    return directors[0];
  }

  private async assignManagementReportTicket(companyId: number) {
    const assignees = await User.findAll({
      where: { companyId, role: UserRole.accountant },
      order: [['createdAt', 'DESC']],
    });

    if (!assignees.length) {
      throw new ConflictException(
        `Cannot find user with role ${UserRole.accountant} to create a ticket`,
      );
    }

    return assignees[0];
  }
}
