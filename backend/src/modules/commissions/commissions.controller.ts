import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { CommissionsService } from './commissions.service';
import { AggregateCommissionsQueryDto } from './dto/aggregate-commissions-query.dto';

/**
 * Commissions REST controller — read-only.
 *
 *   GET /commissions/by-transaction/:transactionId    single breakdown
 *   GET /commissions/totals                           aggregate totals per agent
 *
 * Write path is owned by TransactionsService.advanceStage (atomic with
 * the transaction moving into the COMPLETED stage).
 */
@ApiTags('Commissions')
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('by-transaction/:transactionId')
  @ApiOperation({
    summary: 'Fetch the immutable commission breakdown for a transaction',
    description:
      'Returns `COMMISSION_BREAKDOWN_NOT_FOUND` when the transaction either has not yet reached `completed` or does not exist.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction ObjectId' })
  @ApiNotFoundResponse({
    description: 'No breakdown for that transaction.',
    type: ApiErrorDto,
  })
  async findByTransactionId(
    @Param('transactionId') transactionId: string,
  ) {
    return this.commissionsService.findByTransactionId(transactionId);
  }

  @Get('totals')
  @ApiOperation({
    summary: 'Aggregate commission totals per (agent, currency)',
    description:
      'Drives the Agent Profile and legacy Reports views. For the full report, use `GET /reports/commissions`.',
  })
  async aggregate(@Query() query: AggregateCommissionsQueryDto) {
    return this.commissionsService.aggregateByAgent({
      agentId: query.agentId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}
