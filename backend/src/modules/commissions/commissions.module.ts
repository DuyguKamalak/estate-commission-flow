import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import {
  CommissionBreakdown,
  CommissionBreakdownSchema,
} from './schemas/commission-breakdown.schema';

/**
 * Commissions module — read side of the commission-breakdown aggregate.
 *
 * Notes on module topology:
 *   - This module does NOT depend on `TransactionsModule`. The only
 *     cross-aggregate reference (a string `ref: Transaction.name` in the
 *     schema) is resolved by Mongoose at runtime without needing the
 *     other module's TypeScript dependency. Keeping these modules
 *     decoupled avoids a circular import, since `TransactionsModule`
 *     owns the write path and registers `CommissionBreakdown` in its
 *     own `MongooseModule.forFeature` list.
 *   - `MongooseModule` is re-exported so sibling modules can still
 *     inject the breakdown model via `@InjectModel` if needed.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CommissionBreakdown.name, schema: CommissionBreakdownSchema },
    ]),
  ],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService, MongooseModule],
})
export class CommissionsModule {}
