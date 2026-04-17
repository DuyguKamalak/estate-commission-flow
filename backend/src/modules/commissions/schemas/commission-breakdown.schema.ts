import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Agent } from '../../agents/schemas/agent.schema';
import { Transaction } from '../../transactions/schemas/transaction.schema';
import { CommissionPartyRole } from '../domain/commission-calculator';

/**
 * Persisted commission breakdown for a single transaction.
 *
 * One breakdown per transaction (enforced by unique index on `transactionId`).
 * Monetary fields are integer minor units, mirroring the Transaction schema.
 *
 * `ruleVersion` is persisted so that if the business rules change later
 * (e.g. a tiered agency/agent split), historical rows keep their original
 * semantics and can still be reliably displayed and re-totalled.
 */

@Schema({ _id: false })
export class CommissionParty {
  @Prop({ required: true, type: Types.ObjectId, ref: Agent.name })
  agentId!: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: ['listing', 'selling', 'listing_and_selling'],
  })
  role!: CommissionPartyRole;

  @Prop({
    required: true,
    type: Number,
    min: 0,
    validate: {
      validator: (v: number) => Number.isInteger(v),
      message: 'share must be a non-negative integer (minor units).',
    },
  })
  share!: number;

  @Prop({ required: true, trim: true, maxlength: 500 })
  reason!: string;
}
export const CommissionPartySchema =
  SchemaFactory.createForClass(CommissionParty);

@Schema({
  collection: 'commission_breakdowns',
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
export class CommissionBreakdown {
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: Transaction.name,
  })
  transactionId!: Types.ObjectId;

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
  })
  currency!: string;

  @Prop({
    required: true,
    type: Number,
    min: 0,
    validate: {
      validator: (v: number) => Number.isInteger(v),
      message: 'agencyShare must be a non-negative integer (minor units).',
    },
  })
  agencyShare!: number;

  @Prop({
    required: true,
    type: Number,
    min: 0,
    validate: {
      validator: (v: number) => Number.isInteger(v),
      message: 'agentPool must be a non-negative integer (minor units).',
    },
  })
  agentPool!: number;

  @Prop({ required: true, type: Boolean })
  isSameAgent!: boolean;

  @Prop({
    required: true,
    type: [CommissionPartySchema],
    validate: {
      validator: (v: CommissionParty[]) =>
        Array.isArray(v) && v.length >= 1 && v.length <= 2,
      message: 'parties must contain 1 or 2 entries.',
    },
  })
  parties!: CommissionParty[];

  @Prop({ required: true, trim: true, default: 'v1' })
  ruleVersion!: string;

  @Prop({ required: true, type: Date, default: () => new Date() })
  calculatedAt!: Date;
}

export type CommissionBreakdownDocument =
  HydratedDocument<CommissionBreakdown>;

export const CommissionBreakdownSchema = SchemaFactory.createForClass(
  CommissionBreakdown,
);

CommissionBreakdownSchema.index(
  { transactionId: 1 },
  { unique: true, name: 'uniq_commission_breakdown_transactionId' },
);
CommissionBreakdownSchema.index(
  { 'parties.agentId': 1, calculatedAt: -1 },
  { name: 'idx_commission_breakdown_agent_calculatedAt' },
);
