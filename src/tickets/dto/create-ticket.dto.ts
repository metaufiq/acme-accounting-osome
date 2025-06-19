import { IsEnum, IsNumber, IsPositive } from 'class-validator';

import { TicketType } from '@db/models/Ticket';

export class CreateTicketDto {
  @IsEnum(TicketType, {
    message: `type must be a valid ticket type (${Object.values(TicketType).join(', ')})`,
  })
  type: TicketType;

  @IsNumber({}, { message: 'companyId must be a number' })
  @IsPositive({ message: 'companyId must be a positive number' })
  companyId: number;
}
