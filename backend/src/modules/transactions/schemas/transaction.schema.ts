import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  TRANSACTION_STAGE_ORDER,
  TransactionStage,
} from '../../../common/enums/transaction-stage.enum';
import { TransactionType } from '../../../common/enums/transaction-type.enum';
import { Agent } from '../../agents/schemas/agent.schema';

/**
 * Transaction aggregate root — represents a single property sale or rental
 * deal flowing through the agreement -> earnest_money -> title_deed ->
 * completed lifecycle.
 *
 * Monetary fields are stored as integer MINOR UNITS (e.g. pence for GBP) to
 * sidestep floating-point drift when splitting commissions. See ADR-002.
 *
 * `referenceCode` is the human-facing identifier (TRX-YYYY-XXXXXX) that
 * appears on the UI and on reports; it is indexed unique, and also protects
 * against duplicate-code collisions at the DB layer.
 *
 * Stage-date fields (`earnestMoneyDate`, `titleDeedDate`, `completedAt`) are
 * optional and populated as the transaction advances through each stage.
 */
@Schema({
  collection: 'transactions',
  timestamps: true,
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
export class Transaction {
  @Prop({
    required: true,
    uppercase: true,
    trim: true,
    match: /^TRX-\d{4}-[A-Z0-9]{6}$/,
  })
  referenceCode!: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  propertyTitle!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  propertyAddress!: string;

  @Prop({
    required: true,
    enum: Object.values(TransactionType),
    type: String,
  })
  transactionType!: TransactionType;

  @Prop({
    required: true,
    type: Number,
    min: 0,
    validate: {
      validator: (v: number) => Number.isInteger(v),
      message: 'totalServiceFee must be a non-negative integer (minor units).',
    },
  })
  totalServiceFee!: number;

  @Prop({
    required: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
    default: 'GBP',
  })
  currency!: string;

  @Prop({
    required: true,
    enum: TRANSACTION_STAGE_ORDER,
    type: String,
    default: TransactionStage.AGREEMENT,
  })
  stage!: TransactionStage;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Agent.name,
    index: true,
  })
  listingAgentId!: Types.ObjectId;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Agent.name,
    index: true,
  })
  sellingAgentId!: Types.ObjectId;

  @Prop({ required: true, type: Date, default: () => new Date() })
  agreementDate!: Date;

  @Prop({ type: Date })
  earnestMoneyDate?: Date;

  @Prop({ type: Date })
  titleDeedDate?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ trim: true, maxlength: 2000 })
  notes?: string;
}

export type TransactionDocument = HydratedDocument<Transaction>;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index(
  { referenceCode: 1 },
  { unique: true, name: 'uniq_transactions_referenceCode' },
);
TransactionSchema.index(
  { stage: 1, createdAt: -1 },
  { name: 'idx_transactions_stage_createdAt' },
);
TransactionSchema.index(
  { createdAt: -1 },
  { name: 'idx_transactions_createdAt' },
);
