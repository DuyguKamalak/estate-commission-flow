import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Agent, AgentSchema } from './schemas/agent.schema';

/**
 * Agents module — Sprint 3 scope: schema registration only.
 *
 * Services, controllers and DTOs arrive in Sprint 5 (API layer). Exporting
 * MongooseModule lets sibling modules (transactions, commissions) inject
 * the Agent model via @InjectModel(Agent.name) for cross-aggregate lookups.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }]),
  ],
  exports: [MongooseModule],
})
export class AgentsModule {}
