import { Controller, Get, Param, Query } from '@nestjs/common';
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
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('by-transaction/:transactionId')
  async findByTransactionId(
    @Param('transactionId') transactionId: string,
  ) {
    return this.commissionsService.findByTransactionId(transactionId);
  }

  @Get('totals')
  async aggregate(@Query() query: AggregateCommissionsQueryDto) {
    return this.commissionsService.aggregateByAgent({
      agentId: query.agentId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}
