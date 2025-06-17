import { Module } from '@nestjs/common';
import { TicketsController } from '@/tickets/controller/tickets.controller';
import { TicketsService } from '@/tickets/service/tickets.service';
import { DbModule } from '@/db.module';

@Module({
  imports: [DbModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
