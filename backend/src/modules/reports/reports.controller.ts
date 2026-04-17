import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { buildCommissionsReportCsv } from './commissions-csv';
import { CommissionsReportQueryDto } from './dto/commissions-report-query.dto';
import { CommissionsReportDto } from './dto/commissions-report.dto';
import { DashboardSnapshotDto } from './dto/dashboard.dto';
import { ReportsService } from './reports.service';

/**
 * Reporting endpoints.
 *
 *   GET /reports/dashboard         single-call operations snapshot
 *   GET /reports/commissions       filtered commissions report (JSON)
 *   GET /reports/commissions.csv   same payload serialised to CSV
 *
 * The CSV variant intentionally reuses the JSON service call and
 * then serialises, so the two views are guaranteed to stay in sync.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboard(): Promise<DashboardSnapshotDto> {
    return this.reportsService.getDashboardSnapshot();
  }

  @Get('commissions')
  async getCommissions(
    @Query() query: CommissionsReportQueryDto,
  ): Promise<CommissionsReportDto> {
    return this.reportsService.getCommissionsReport({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      agentId: query.agentId,
      currency: query.currency,
    });
  }

  @Get('commissions.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getCommissionsCsv(
    @Query() query: CommissionsReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const report = await this.reportsService.getCommissionsReport({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      agentId: query.agentId,
      currency: query.currency,
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="commissions-${stamp}.csv"`,
    );
    return buildCommissionsReportCsv(report);
  }
}
