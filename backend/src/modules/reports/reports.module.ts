import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Agent, AgentSchema } from '../agents/schemas/agent.schema';
import {
  CommissionBreakdown,
  CommissionBreakdownSchema,
} from '../commissions/schemas/commission-breakdown.schema';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/schemas/transaction.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Reports module.
 *
 * Intentionally registers Transaction, CommissionBreakdown, and
 * Agent schemas via `forFeature` rather than depending on the
 * write-side feature modules. This keeps reporting decoupled:
 * changes to TransactionsModule / AgentsModule internals (service
 * shape, exports) cannot break report reads.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: CommissionBreakdown.name, schema: CommissionBreakdownSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
