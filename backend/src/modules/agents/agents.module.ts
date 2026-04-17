import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent, AgentSchema } from './schemas/agent.schema';

/**
 * Agents module — schema + service + controller.
 *
 * Exports `AgentsService` so other modules (e.g. transactions) can assert
 * that listing / selling agent IDs point to active agents before writing
 * a new transaction. Also re-exports `MongooseModule` so the Agent model
 * can be injected from sibling modules when a direct query is cheaper
 * than going through the service.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }]),
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService, MongooseModule],
})
export class AgentsModule {}
