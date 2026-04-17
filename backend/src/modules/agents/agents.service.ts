import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ErrorCode } from '../../common/enums/error-code.enum';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../common/dto/pagination-query.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { Agent, AgentDocument } from './schemas/agent.schema';

/**
 * Agents service.
 *
 * Responsibilities:
 *   - Create / read / update agents.
 *   - Translate Mongo-level constraint violations (duplicate email) into
 *     domain exceptions with stable error codes so the frontend can branch
 *     on them deterministically.
 *   - `deactivate` is a soft-delete: it flips `isActive` to false so
 *     historical transactions that reference the agent remain intact.
 */
@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name)
    private readonly agentModel: Model<AgentDocument>,
  ) {}

  async create(dto: CreateAgentDto): Promise<AgentDocument> {
    try {
      const doc = await this.agentModel.create({
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone,
        isActive: dto.isActive ?? true,
      });
      return doc;
    } catch (err) {
      this.translateWriteError(err, dto.email);
      throw err;
    }
  }

  async findAll(
    query: ListAgentsQueryDto,
  ): Promise<PaginatedResult<AgentDocument>> {
    const filter: Record<string, unknown> = {};
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }
    if (query.search) {
      const escaped = escapeRegex(query.search);
      filter.$or = [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const page = query.page;
    const pageSize = query.pageSize;

    const [items, total] = await Promise.all([
      this.agentModel
        .find(filter)
        .sort({ lastName: 1, firstName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.agentModel.countDocuments(filter).exec(),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  async findById(id: string): Promise<AgentDocument> {
    this.assertValidObjectId(id);
    const doc = await this.agentModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundDomainException(
        ErrorCode.AGENT_NOT_FOUND,
        `Agent ${id} not found.`,
      );
    }
    return doc;
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentDocument> {
    this.assertValidObjectId(id);
    const update: Record<string, unknown> = {};
    if (dto.firstName !== undefined) update.firstName = dto.firstName;
    if (dto.lastName !== undefined) update.lastName = dto.lastName;
    if (dto.email !== undefined) update.email = dto.email.toLowerCase().trim();
    if (dto.phone !== undefined) update.phone = dto.phone;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;

    try {
      const doc = await this.agentModel
        .findByIdAndUpdate(id, update, { new: true, runValidators: true })
        .exec();
      if (!doc) {
        throw new NotFoundDomainException(
          ErrorCode.AGENT_NOT_FOUND,
          `Agent ${id} not found.`,
        );
      }
      return doc;
    } catch (err) {
      this.translateWriteError(err, dto.email ?? '');
      throw err;
    }
  }

  /**
   * Soft-deactivates an agent.
   *
   * Hard delete is deliberately not offered — historical transactions and
   * commission breakdowns reference the agent by ObjectId and must not be
   * orphaned.
   */
  async deactivate(id: string): Promise<AgentDocument> {
    return this.update(id, { isActive: false });
  }

  /**
   * Guarantees the agent exists and is active, or throws. Used by the
   * transactions service when validating listing/selling agent IDs on a
   * new transaction.
   */
  async assertActiveAgentExists(id: string): Promise<AgentDocument> {
    const doc = await this.findById(id);
    if (!doc.isActive) {
      throw new DomainException(
        ErrorCode.AGENT_INACTIVE,
        `Agent ${id} is deactivated and cannot be assigned to new transactions.`,
      );
    }
    return doc;
  }

  private assertValidObjectId(id: string): void {
    if (!isValidObjectId(id)) {
      throw new NotFoundDomainException(
        ErrorCode.AGENT_NOT_FOUND,
        `Agent ${id} not found.`,
      );
    }
  }

  private translateWriteError(err: unknown, email: string): never | void {
    if (err instanceof DomainException) {
      throw err;
    }
    if (isDuplicateKeyError(err)) {
      throw new ConflictDomainException(
        ErrorCode.AGENT_EMAIL_IN_USE,
        `An agent with email "${email}" already exists.`,
      );
    }
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 11000
  );
}

/** Re-exported helper for callers who only have an ObjectId string. */
export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
