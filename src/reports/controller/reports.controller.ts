import { Controller, Get, Post, HttpCode } from '@nestjs/common';

import { ReportsService } from '../service/reports.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get()
  report(): Record<string, string> {
    return {
      'accounts.csv': this.reportsService.state('accounts'),
      'yearly.csv': this.reportsService.state('yearly'),
      'fs.csv': this.reportsService.state('fs'),
    };
  }

  @Post()
  @HttpCode(201)
  generate(): { message: string } {
    setImmediate(() => {
      void Promise.allSettled([
        this.reportsService.accounts(),
        this.reportsService.yearly(),
        this.reportsService.fs(),
      ]);
    });
    return { message: 'processing' };
  }
}
