import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import {
  CommissionBreakdown,
  CommissionBreakdownSchema,
} from '../commissions/schemas/commission-breakdown.schema';
import {
  Transaction,
  TransactionSchema,
} from './schemas/transaction.schema';
import {
  TransactionStageHistory,
  TransactionStageHistorySchema,
} from './schemas/transaction-stage-history.schema';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

/**
 * Transactions module.
 *
 * The service is the write-side aggregate root for transactions, their
 * stage history, and (on completion) commission breakdowns. We register
 * the CommissionBreakdown schema directly here — rather than going
 * through `CommissionsModule` — to avoid a circular module dependency
 * between transactions and commissions. `CommissionsModule` remains the
 * read-side owner of breakdowns.
 */
@Module({
  imports: [
    AgentsModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      {
        name: TransactionStageHistory.name,
        schema: TransactionStageHistorySchema,
      },
      { name: CommissionBreakdown.name, schema: CommissionBreakdownSchema },
    ]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService, MongooseModule],
})
export class TransactionsModule {}
