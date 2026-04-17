import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
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
@ApiTags('Reports')
@ApiBadRequestResponse({
  description: 'Invalid filter (e.g. malformed ISO date, bad ObjectId).',
  type: ApiErrorDto,
})
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Operations dashboard snapshot',
    description:
      'Single-call payload powering the dashboard: KPIs, stage distribution, MTD agency earnings grouped by currency, and the most recent transactions.',
  })
  async getDashboard(): Promise<DashboardSnapshotDto> {
    return this.reportsService.getDashboardSnapshot();
  }

  @Get('commissions')
  @ApiOperation({
    summary: 'Filtered commissions report (JSON)',
    description:
      'Returns currency totals, a per-agent leaderboard (with joined agent names), and the underlying completed-transaction ledger — all in one payload.',
  })
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
  @ApiOperation({
    summary: 'Filtered commissions report (CSV)',
    description:
      'Same data as `GET /reports/commissions`, serialised to CSV. Sets `Content-Disposition: attachment` with a timestamped filename so browsers download directly.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV document with three stacked sections.',
    content: {
      'text/csv': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
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
