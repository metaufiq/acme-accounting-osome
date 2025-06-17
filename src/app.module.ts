import { Module } from '@nestjs/common';
import { DbModule } from '@/db.module';
import { TicketsModule } from '@/tickets/tickets.module';
import { ReportsModule } from '@/reports/reports.module';
import { HealthcheckController } from '@/healthcheck/healthcheck.controller';

@Module({
  imports: [DbModule, TicketsModule, ReportsModule],
  controllers: [HealthcheckController],
})
export class AppModule {}
