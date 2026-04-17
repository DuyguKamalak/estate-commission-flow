import { Controller, Get } from '@nestjs/common';
import { DashboardSnapshotDto } from './dto/dashboard.dto';
import { ReportsService } from './reports.service';

/**
 * Reporting endpoints. Currently exposes the dashboard snapshot used
 * by the Nuxt operations console; additional report endpoints (CSV
 * export, completed-deals ledger, agent leaderboards) can be layered
 * on later without reshaping this route.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboard(): Promise<DashboardSnapshotDto> {
    return this.reportsService.getDashboardSnapshot();
  }
}
