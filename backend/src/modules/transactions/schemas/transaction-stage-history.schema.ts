import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  TRANSACTION_STAGE_ORDER,
  TransactionStage,
} from '../../../common/enums/transaction-stage.enum';
import { Transaction } from './transaction.schema';

/**
 * Immutable audit row describing a single stage transition on a transaction.
 *
 * Design notes:
 *   - Written atomically alongside the Transaction stage update (via session
 *     in the service layer) so the two never drift.
 *   - `fromStage` is null for the initial `agreement` row that we insert on
 *     transaction creation.
 *   - `triggeredBy` is a free-form identifier; in the MVP this is "system"
 *     since the brief does not include authentication, but the field is in
 *     place so a later user-session feature slots in without a migration.
 */
@Schema({
  collection: 'transaction_stage_history',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    },
  },
})
export class TransactionStageHistory {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Transaction.name,
    index: true,
  })
  transactionId!: Types.ObjectId;

  @Prop({
    required: false,
    enum: TRANSACTION_STAGE_ORDER,
    type: String,
    default: null,
  })
  fromStage!: TransactionStage | null;

  @Prop({
    required: true,
    enum: TRANSACTION_STAGE_ORDER,
    type: String,
  })
  toStage!: TransactionStage;

  @Prop({ required: true, type: Date, default: () => new Date() })
  changedAt!: Date;

  @Prop({ trim: true, maxlength: 500 })
  reason?: string;

  @Prop({ required: true, default: 'system', trim: true, maxlength: 100 })
  triggeredBy!: string;
}

export type TransactionStageHistoryDocument =
  HydratedDocument<TransactionStageHistory>;

export const TransactionStageHistorySchema = SchemaFactory.createForClass(
  TransactionStageHistory,
);

TransactionStageHistorySchema.index(
  { transactionId: 1, changedAt: -1 },
  { name: 'idx_stage_history_transaction_changedAt' },
);
