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
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
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
@ApiTags('Agents')
@ApiBadRequestResponse({
  description: 'Validation failed — one or more fields are invalid.',
  type: ApiErrorDto,
})
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new agent',
    description:
      'Email must be unique; a duplicate returns `AGENT_EMAIL_IN_USE` (409).',
  })
  @ApiConflictResponse({
    description: 'Email already in use.',
    type: ApiErrorDto,
  })
  async create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List agents',
    description:
      'Paginated. Supports active-state filter and case-insensitive search.',
  })
  async findAll(@Query() query: ListAgentsQueryDto) {
    return this.agentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch an agent by id' })
  @ApiParam({ name: 'id', description: 'Agent ObjectId' })
  @ApiNotFoundResponse({
    description: 'Agent not found (AGENT_NOT_FOUND).',
    type: ApiErrorDto,
  })
  async findById(@Param('id') id: string) {
    return this.agentsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update mutable agent fields',
    description:
      'Partial update: only supplied fields are touched. Pass `isActive: true` to re-activate a deactivated agent.',
  })
  @ApiParam({ name: 'id', description: 'Agent ObjectId' })
  @ApiNotFoundResponse({
    description: 'Agent not found.',
    type: ApiErrorDto,
  })
  @ApiConflictResponse({
    description: 'Email already in use by another agent.',
    type: ApiErrorDto,
  })
  async update(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate an agent (soft delete)',
    description:
      'Flips `isActive` to false. Historical transaction references are preserved. Reactivate via PATCH `{ "isActive": true }`.',
  })
  @ApiParam({ name: 'id', description: 'Agent ObjectId' })
  @ApiOkResponse({ description: 'Agent after deactivation.' })
  @ApiNotFoundResponse({
    description: 'Agent not found.',
    type: ApiErrorDto,
  })
  async deactivate(@Param('id') id: string) {
    return this.agentsService.deactivate(id);
  }
}
