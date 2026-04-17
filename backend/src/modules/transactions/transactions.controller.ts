import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { TransactionsService } from './transactions.service';
import { AdvanceStageDto } from './dto/advance-stage.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

/**
 * Transactions REST controller.
 *
 * Routes:
 *   POST   /transactions                       create
 *   GET    /transactions                       list (filter + paginate)
 *   GET    /transactions/:id                   fetch by ObjectId
 *   GET    /transactions/by-reference/:code    fetch by TRX-YYYY-XXXXXX
 *   GET    /transactions/:id/history           stage history (ascending)
 *   PATCH  /transactions/:id                   update mutable metadata
 *   POST   /transactions/:id/advance-stage     move to the next lifecycle stage
 */
@ApiTags('Transactions')
@ApiBadRequestResponse({
  description: 'Validation failed.',
  type: ApiErrorDto,
})
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new transaction',
    description:
      'The server assigns the reference code (`TRX-YYYY-XXXXXX`), opens the transaction in the `agreement` stage, and writes the initial stage-history row atomically.',
  })
  @ApiNotFoundResponse({
    description: 'Referenced listing or selling agent does not exist.',
    type: ApiErrorDto,
  })
  @ApiConflictResponse({
    description:
      'Agent is inactive (`AGENT_INACTIVE`) or reference-code collision exhausted retries.',
    type: ApiErrorDto,
  })
  async create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List transactions (paginated + filterable)',
    description:
      'Supports stage, type, agent, date-range, search and reference-code filters. Results are sorted by `createdAt` desc.',
  })
  async findAll(@Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findAll(query);
  }

  @Get('by-reference/:code')
  @ApiOperation({
    summary: 'Fetch a transaction by its reference code',
    description:
      'Accepts a human-typed `TRX-YYYY-XXXXXX` string; the code is uppercased server-side.',
  })
  @ApiParam({ name: 'code', example: 'TRX-2026-AKZMN7' })
  @ApiNotFoundResponse({
    description: 'No transaction with that reference code.',
    type: ApiErrorDto,
  })
  async findByReferenceCode(@Param('code') code: string) {
    return this.transactionsService.findByReferenceCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a transaction by ObjectId' })
  @ApiParam({ name: 'id', description: 'Transaction ObjectId' })
  @ApiNotFoundResponse({
    description: 'Transaction not found.',
    type: ApiErrorDto,
  })
  async findById(@Param('id') id: string) {
    return this.transactionsService.findById(id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Fetch stage history (ascending)',
    description:
      'Returns every `from → to` stage transition, including the initial null → agreement entry created at insert time.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ObjectId' })
  async findHistory(@Param('id') id: string) {
    return this.transactionsService.findStageHistory(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update mutable transaction metadata',
    description:
      'Only `propertyTitle`, `propertyAddress` and `notes` are mutable. Stage, agents, fee, and reference code are immutable by design.',
  })
  @ApiParam({ name: 'id', description: 'Transaction ObjectId' })
  @ApiNotFoundResponse({
    description: 'Transaction not found.',
    type: ApiErrorDto,
  })
  async update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, dto);
  }

  @Post(':id/advance-stage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Advance to the next lifecycle stage',
    description:
      'Forward-only, one step at a time. Reaching `completed` atomically persists the immutable commission breakdown (see ADR-002).',
  })
  @ApiParam({ name: 'id', description: 'Transaction ObjectId' })
  @ApiBadRequestResponse({
    description:
      'Invalid stage transition — `toStage` is not exactly one step ahead (`INVALID_STAGE_TRANSITION`).',
    type: ApiErrorDto,
  })
  @ApiNotFoundResponse({
    description: 'Transaction not found.',
    type: ApiErrorDto,
  })
  async advanceStage(
    @Param('id') id: string,
    @Body() dto: AdvanceStageDto,
  ) {
    return this.transactionsService.advanceStage(id, dto);
  }
}
