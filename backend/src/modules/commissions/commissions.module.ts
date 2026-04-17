import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { TransactionsModule } from '../transactions/transactions.module';
import {
  CommissionBreakdown,
  CommissionBreakdownSchema,
} from './schemas/commission-breakdown.schema';

/**
 * Commissions module — Sprint 3 scope: persisted breakdown schema + pure
 * domain calculator. The orchestration service (triggered when a
 * transaction reaches COMPLETED) is wired in Sprint 5.
 */
@Module({
  imports: [
    AgentsModule,
    TransactionsModule,
    MongooseModule.forFeature([
      { name: CommissionBreakdown.name, schema: CommissionBreakdownSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class CommissionsModule {}
