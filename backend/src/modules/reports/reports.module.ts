import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
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
 * Intentionally registers both Transaction and CommissionBreakdown
 * schemas via `forFeature` rather than depending on the write-side
 * feature modules. This keeps reporting decoupled: changes to
 * TransactionsModule internals (service shape, exports) cannot break
 * dashboard reads.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: CommissionBreakdown.name, schema: CommissionBreakdownSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
