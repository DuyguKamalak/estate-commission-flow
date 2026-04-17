import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AgentsService } from './agents.service';
import { Agent } from './schemas/agent.schema';
import {
  ConflictDomainException,
  DomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

/**
 * Small helper that fakes a chainable Mongoose Query: `.sort().skip().limit().exec()`.
 * Returns whatever `exec` resolves to.
 */
function chainable(result: unknown) {
  const query: Record<string, jest.Mock> = {};
  query.sort = jest.fn().mockReturnValue(query);
  query.skip = jest.fn().mockReturnValue(query);
  query.limit = jest.fn().mockReturnValue(query);
  query.exec = jest.fn().mockResolvedValue(result);
  return query;
}

describe('AgentsService', () => {
  let service: AgentsService;
  const model = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: getModelToken(Agent.name), useValue: model },
      ],
    }).compile();

    service = moduleRef.get(AgentsService);
  });

  describe('create', () => {
    it('lowercases/trims the email and forwards to the model', async () => {
      const created = { _id: new Types.ObjectId(), email: 'jane@ex.com' };
      model.create.mockResolvedValueOnce(created);

      const result = await service.create({
        firstName: 'Jane',
        lastName: 'Doe',
        email: '  JANE@EX.com ',
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@ex.com', isActive: true }),
      );
      expect(result).toBe(created);
    });

    it('translates duplicate-key errors to AGENT_EMAIL_IN_USE', async () => {
      model.create.mockRejectedValueOnce({ code: 11000 });

      const err = await service
        .create({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@ex.com',
        })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ConflictDomainException);
      expect((err as ConflictDomainException).errorCode).toBe(
        ErrorCode.AGENT_EMAIL_IN_USE,
      );
    });

    it('re-raises other write errors untouched', async () => {
      const boom = new Error('boom');
      model.create.mockRejectedValueOnce(boom);

      await expect(
        service.create({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@ex.com',
        }),
      ).rejects.toBe(boom);
    });
  });

  describe('findAll', () => {
    it('applies isActive + search filters and paginates', async () => {
      model.find.mockReturnValueOnce(chainable([{ _id: '1' }, { _id: '2' }]));
      model.countDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(42),
      });

      const result = await service.findAll({
        isActive: true,
        search: 'jane',
        page: 2,
        pageSize: 10,
      });

      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          $or: expect.any(Array),
        }),
      );
      expect(result.total).toBe(42);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.items).toHaveLength(2);
    });

    it('escapes regex metacharacters in search to prevent injection', async () => {
      model.find.mockReturnValueOnce(chainable([]));
      model.countDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({
        search: '.*(',
        page: 1,
        pageSize: 20,
      });

      const filter = model.find.mock.calls[0][0] as {
        $or: Array<{ firstName: { $regex: string } }>;
      };
      for (const clause of filter.$or) {
        const pattern = Object.values(clause)[0] as { $regex: string };
        // We expect each metacharacter to be backslash-escaped.
        expect(pattern.$regex).toBe('\\.\\*\\(');
      }
    });
  });

  describe('findById', () => {
    it('throws AGENT_NOT_FOUND on invalid ObjectId', async () => {
      const err = await service
        .findById('not-an-id')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundDomainException);
      expect((err as NotFoundDomainException).errorCode).toBe(
        ErrorCode.AGENT_NOT_FOUND,
      );
    });

    it('throws AGENT_NOT_FOUND when model returns null', async () => {
      model.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findById(new Types.ObjectId().toHexString()),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AGENT_NOT_FOUND,
      });
    });

    it('returns the document on hit', async () => {
      const doc = { _id: new Types.ObjectId(), firstName: 'Jane' };
      model.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(doc),
      });

      const result = await service.findById(new Types.ObjectId().toHexString());
      expect(result).toBe(doc);
    });
  });

  describe('update', () => {
    it('applies only provided fields and honours runValidators', async () => {
      const id = new Types.ObjectId().toHexString();
      const updated = { _id: id, isActive: false };
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(updated),
      });

      await service.update(id, { isActive: false });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        { isActive: false },
        expect.objectContaining({ new: true, runValidators: true }),
      );
    });

    it('translates duplicate email updates to AGENT_EMAIL_IN_USE', async () => {
      const id = new Types.ObjectId().toHexString();
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockRejectedValue({ code: 11000 }),
      });

      await expect(
        service.update(id, { email: 'taken@ex.com' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AGENT_EMAIL_IN_USE,
      });
    });

    it('throws AGENT_NOT_FOUND when update targets a missing agent', async () => {
      const id = new Types.ObjectId().toHexString();
      model.findByIdAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.update(id, { firstName: 'x' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.AGENT_NOT_FOUND,
      });
    });
  });

  describe('deactivate', () => {
    it('flips isActive to false via update()', async () => {
      const id = new Types.ObjectId().toHexString();
      const spy = jest
        .spyOn(service, 'update')
        .mockResolvedValueOnce({ isActive: false } as never);

      await service.deactivate(id);

      expect(spy).toHaveBeenCalledWith(id, { isActive: false });
    });
  });

  describe('assertActiveAgentExists', () => {
    it('returns the doc when active', async () => {
      const doc = { _id: new Types.ObjectId(), isActive: true };
      jest.spyOn(service, 'findById').mockResolvedValueOnce(doc as never);

      await expect(
        service.assertActiveAgentExists(new Types.ObjectId().toHexString()),
      ).resolves.toBe(doc);
    });

    it('throws AGENT_INACTIVE when isActive is false', async () => {
      const doc = { _id: new Types.ObjectId(), isActive: false };
      jest.spyOn(service, 'findById').mockResolvedValueOnce(doc as never);

      const err = await service
        .assertActiveAgentExists(new Types.ObjectId().toHexString())
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(DomainException);
      expect((err as DomainException).errorCode).toBe(ErrorCode.AGENT_INACTIVE);
    });
  });
});
