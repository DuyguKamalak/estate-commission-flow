import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import {
  Transaction,
  TransactionSchema,
} from './schemas/transaction.schema';
import {
  TransactionStageHistory,
  TransactionStageHistorySchema,
} from './schemas/transaction-stage-history.schema';

/**
 * Transactions module — Sprint 3 scope: schemas + domain (stage machine).
 *
 * Services (CRUD, stage advance orchestration, reference-code retry on
 * duplicate-key collision) land in Sprint 5. Exporting MongooseModule lets
 * the commissions module reuse the Transaction model for integrity checks
 * without circular imports.
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
    ]),
  ],
  exports: [MongooseModule],
})
export class TransactionsModule {}
