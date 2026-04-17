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
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Get()
  async findAll(@Query() query: ListTransactionsQueryDto) {
    return this.transactionsService.findAll(query);
  }

  @Get('by-reference/:code')
  async findByReferenceCode(@Param('code') code: string) {
    return this.transactionsService.findByReferenceCode(code);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.transactionsService.findById(id);
  }

  @Get(':id/history')
  async findHistory(@Param('id') id: string) {
    return this.transactionsService.findStageHistory(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactionsService.update(id, dto);
  }

  @Post(':id/advance-stage')
  @HttpCode(HttpStatus.OK)
  async advanceStage(
    @Param('id') id: string,
    @Body() dto: AdvanceStageDto,
  ) {
    return this.transactionsService.advanceStage(id, dto);
  }
}
