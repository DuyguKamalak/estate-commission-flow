import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionStage } from '../../common/enums/transaction-stage.enum';
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
});
