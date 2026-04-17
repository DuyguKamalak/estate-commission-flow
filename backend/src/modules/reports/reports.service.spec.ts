import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { TransactionStage } from '../../common/enums/transaction-stage.enum';
import { Agent } from '../agents/schemas/agent.schema';
import { CommissionBreakdown } from '../commissions/schemas/commission-breakdown.schema';
import { Transaction } from '../transactions/schemas/transaction.schema';
import { ReportsService } from './reports.service';

/**
 * ReportsService unit tests. We mock the two Mongoose models and
 * assert:
 *   - stage distribution is hydrated into all four stages, even if the
 *     aggregation returns fewer buckets (e.g. no COMPLETED yet),
 *   - active / pending / completed-MTD counts are derived correctly,
 *   - agency earnings pass through grouped by currency,
 *   - recent transactions are projected with a stable shape.
 */
describe('ReportsService', () => {
  let service: ReportsService;

  const transactionModel = {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    find: jest.fn(),
  };

  const breakdownModel = {
    aggregate: jest.fn(),
    find: jest.fn(),
  };

  const agentModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getModelToken(Transaction.name),
          useValue: transactionModel,
        },
        {
          provide: getModelToken(CommissionBreakdown.name),
          useValue: breakdownModel,
        },
        {
          provide: getModelToken(Agent.name),
          useValue: agentModel,
        },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
  });

  it('hydrates an empty stage distribution into zeros for every stage', async () => {
    transactionModel.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue([]),
    });
    transactionModel.countDocuments.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(0),
    });
    breakdownModel.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue([]),
    });
    transactionModel.find.mockReturnValueOnce({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });

    const snapshot = await service.getDashboardSnapshot(new Date('2026-04-17'));

    expect(snapshot.stageDistribution).toEqual({
      [TransactionStage.AGREEMENT]: 0,
      [TransactionStage.EARNEST_MONEY]: 0,
      [TransactionStage.TITLE_DEED]: 0,
      [TransactionStage.COMPLETED]: 0,
    });
    expect(snapshot.activeTransactionsCount).toBe(0);
    expect(snapshot.pendingTitleDeedCount).toBe(0);
    expect(snapshot.completedThisMonthCount).toBe(0);
    expect(snapshot.agencyEarningsMtd).toEqual([]);
    expect(snapshot.recentTransactions).toEqual([]);
  });

  it('derives active count as sum of non-completed stages and preserves agency earnings buckets', async () => {
    transactionModel.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue([
        { _id: TransactionStage.AGREEMENT, count: 3 },
        { _id: TransactionStage.EARNEST_MONEY, count: 2 },
        { _id: TransactionStage.TITLE_DEED, count: 4 },
        { _id: TransactionStage.COMPLETED, count: 7 },
      ]),
    });
    transactionModel.countDocuments.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValue(5),
    });
    breakdownModel.aggregate.mockReturnValueOnce({
      exec: jest
        .fn()
        .mockResolvedValue([{ _id: 'GBP', total: 150_000 }]),
    });
    transactionModel.find.mockReturnValueOnce({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: 'obj-1',
          referenceCode: 'TRX-2026-ABCDEF',
          propertyTitle: 'Primrose Hill flat',
          propertyAddress: '1 Primrose Hill, London',
          stage: TransactionStage.AGREEMENT,
          transactionType: 'sale',
          totalServiceFee: 100_000,
          currency: 'GBP',
          createdAt: new Date('2026-04-17T12:00:00Z'),
        },
      ]),
    });

    const snapshot = await service.getDashboardSnapshot(new Date('2026-04-17'));

    expect(snapshot.activeTransactionsCount).toBe(3 + 2 + 4);
    expect(snapshot.pendingTitleDeedCount).toBe(4);
    expect(snapshot.completedThisMonthCount).toBe(5);
    expect(snapshot.agencyEarningsMtd).toEqual([
      { currency: 'GBP', total: 150_000 },
    ]);
    expect(snapshot.recentTransactions).toHaveLength(1);
    expect(snapshot.recentTransactions[0]).toEqual(
      expect.objectContaining({
        id: 'obj-1',
        referenceCode: 'TRX-2026-ABCDEF',
        stage: TransactionStage.AGREEMENT,
        totalServiceFee: 100_000,
        currency: 'GBP',
      }),
    );
  });

  describe('getCommissionsReport', () => {
    it('returns a shaped-but-empty payload when there are no breakdowns', async () => {
      breakdownModel.aggregate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) });
      breakdownModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const report = await service.getCommissionsReport({
        from: new Date('2026-04-01T00:00:00Z'),
        to: new Date('2026-04-30T23:59:59Z'),
        currency: 'GBP',
      });

      expect(report.range).toEqual({
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.000Z',
      });
      expect(report.filters).toEqual({ agentId: null, currency: 'GBP' });
      expect(report.currencyTotals).toEqual([]);
      expect(report.agentTotals).toEqual([]);
      expect(report.transactions).toEqual([]);
    });

    it('returns empty report when agentId is not a valid ObjectId without hitting DB', async () => {
      const report = await service.getCommissionsReport({
        agentId: 'not-an-id',
      });

      expect(report.filters).toEqual({ agentId: 'not-an-id', currency: null });
      expect(report.currencyTotals).toEqual([]);
      expect(report.agentTotals).toEqual([]);
      expect(report.transactions).toEqual([]);
      expect(breakdownModel.aggregate).not.toHaveBeenCalled();
      expect(breakdownModel.find).not.toHaveBeenCalled();
    });

    it('hydrates agent names on the leaderboard and ledger rows', async () => {
      const agentOneId = new Types.ObjectId();
      const agentTwoId = new Types.ObjectId();
      const txId = new Types.ObjectId();

      breakdownModel.aggregate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([
            {
              _id: 'GBP',
              transactionCount: 1,
              totalServiceFee: 100_000,
              agencyShare: 50_000,
              agentPool: 50_000,
            },
          ]),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([
            {
              _id: { agentId: agentOneId, currency: 'GBP' },
              totalShare: 25_000,
              transactionCount: 1,
            },
            {
              _id: { agentId: agentTwoId, currency: 'GBP' },
              totalShare: 25_000,
              transactionCount: 1,
            },
          ]),
        });
      breakdownModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            transactionId: txId,
            currency: 'GBP',
            totalServiceFee: 100_000,
            agencyShare: 50_000,
            agentPool: 50_000,
            isSameAgent: false,
            ruleVersion: 'v1',
            calculatedAt: new Date('2026-04-12T09:00:00Z'),
            parties: [
              { agentId: agentOneId, role: 'listing', share: 25_000 },
              { agentId: agentTwoId, role: 'selling', share: 25_000 },
            ],
          },
        ]),
      });

      /*
       * The leaderboard fetches agents once, and the ledger fetches
       * transactions + agents in parallel. Our mock resolves all
       * `agentModel.find` calls with the same roster so name hydration
       * works for both code paths.
       */
      agentModel.find
        .mockReturnValueOnce({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            { _id: agentOneId, firstName: 'Jane', lastName: 'Doe', email: 'jane@x' },
            { _id: agentTwoId, firstName: 'John', lastName: 'Roe', email: 'john@x' },
          ]),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            { _id: agentOneId, firstName: 'Jane', lastName: 'Doe', email: 'jane@x' },
            { _id: agentTwoId, firstName: 'John', lastName: 'Roe', email: 'john@x' },
          ]),
        });
      transactionModel.find.mockReturnValueOnce({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: txId,
            referenceCode: 'TRX-2026-TEST01',
            propertyTitle: 'Test flat',
            stage: TransactionStage.COMPLETED,
          },
        ]),
      });

      const report = await service.getCommissionsReport({});

      expect(report.currencyTotals).toEqual([
        {
          currency: 'GBP',
          transactionCount: 1,
          totalServiceFee: 100_000,
          agencyShare: 50_000,
          agentPool: 50_000,
        },
      ]);
      expect(report.agentTotals).toEqual([
        {
          agentId: String(agentOneId),
          agentName: 'Jane Doe',
          agentEmail: 'jane@x',
          currency: 'GBP',
          totalShare: 25_000,
          transactionCount: 1,
        },
        {
          agentId: String(agentTwoId),
          agentName: 'John Roe',
          agentEmail: 'john@x',
          currency: 'GBP',
          totalShare: 25_000,
          transactionCount: 1,
        },
      ]);
      expect(report.transactions).toHaveLength(1);
      expect(report.transactions[0]).toEqual(
        expect.objectContaining({
          referenceCode: 'TRX-2026-TEST01',
          propertyTitle: 'Test flat',
          currency: 'GBP',
          totalServiceFee: 100_000,
          ruleVersion: 'v1',
          isSameAgent: false,
        }),
      );
      expect(report.transactions[0].parties).toEqual([
        expect.objectContaining({
          agentName: 'Jane Doe',
          role: 'listing',
          share: 25_000,
        }),
        expect.objectContaining({
          agentName: 'John Roe',
          role: 'selling',
          share: 25_000,
        }),
      ]);
    });
  });
});
