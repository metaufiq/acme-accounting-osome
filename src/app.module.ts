import { Module } from '@nestjs/common';
import { DbModule } from '@/db.module';
import { TicketsModule } from '@/tickets/tickets.module';
import { ReportsController } from '@/reports/reports.controller';
import { HealthcheckController } from '@/healthcheck/healthcheck.controller';
import { ReportsService } from '@/reports/reports.service';

@Module({
  imports: [DbModule, TicketsModule],
  controllers: [ReportsController, HealthcheckController],
  providers: [ReportsService],
})
export class AppModule {}
