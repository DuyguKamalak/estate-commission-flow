import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

/**
 * Agents REST controller.
 *
 * Endpoints mirror the service surface directly. Authentication is out of
 * scope for this case, so there is no guard wiring — when it is introduced
 * it slots in as a class-level `@UseGuards(...)` without changing any
 * method signature.
 */
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Get()
  async findAll(@Query() query: ListAgentsQueryDto) {
    return this.agentsService.findAll(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.agentsService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  /**
   * Soft delete — sets `isActive = false`. Use PATCH with
   * `{ "isActive": true }` to re-activate later.
   */
  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    return this.agentsService.deactivate(id);
  }
}
