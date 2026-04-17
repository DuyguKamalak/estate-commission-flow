import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Agent — a person who can act as a listing and/or selling agent on a
 * transaction. Commission breakdowns reference agents by ObjectId.
 *
 * Uniqueness:
 *   - `email` is globally unique (enforced by index) so we can safely use
 *     it as a lookup key in admin tooling or future auth layers.
 *
 * No soft-delete in the MVP: the `isActive` flag excludes agents from new
 * transactions without breaking historical commission rows that still
 * reference them. This matches the "deactivated but not deleted" pattern
 * called out in the brief.
 */
@Schema({
  collection: 'agents',
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
export class Agent {
  @Prop({ required: true, trim: true, maxlength: 100 })
  firstName!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  lastName!: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  })
  email!: string;

  @Prop({ trim: true, maxlength: 40 })
  phone?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export type AgentDocument = HydratedDocument<Agent>;
export const AgentSchema = SchemaFactory.createForClass(Agent);

AgentSchema.index({ email: 1 }, { unique: true, name: 'uniq_agents_email' });
AgentSchema.index(
  { lastName: 1, firstName: 1 },
  { name: 'idx_agents_name' },
);

AgentSchema.virtual('fullName').get(function (this: Agent) {
  return `${this.firstName} ${this.lastName}`.trim();
});
