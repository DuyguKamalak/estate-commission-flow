import { defineStore } from 'pinia';
import type {
  ListTransactionsQuery,
  PaginatedResult,
  Transaction,
  TransactionStageHistory,
  CommissionBreakdown,
  TransactionStage,
} from '~/types/api';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Transactions store.
 *
 * Keeps the most recent list result in state (so the list page can
 * survive back-navigation without a re-fetch) plus a per-id cache of
 * detail pages. Mutations (create / advanceStage) invalidate both
 * caches to keep the UI honest.
 */
export const useTransactionsStore = defineStore('transactions', {
  state: () => ({
    list: null as PaginatedResult<Transaction> | null,
    listLoading: false,
    listError: null as string | null,
    lastQuery: { page: 1, pageSize: DEFAULT_PAGE_SIZE } as ListTransactionsQuery,

    byId: {} as Record<string, Transaction>,
    detailLoading: false,
    detailError: null as string | null,

    stageHistoryByTx: {} as Record<string, TransactionStageHistory[]>,
    breakdownByTx: {} as Record<string, CommissionBreakdown | null>,
  }),

  getters: {
    items: (state): Transaction[] => state.list?.items ?? [],
    total: (state): number => state.list?.total ?? 0,
  },

  actions: {
    async fetchList(query: ListTransactionsQuery = {}) {
      const client = useApiClient();
      this.listLoading = true;
      this.listError = null;
      this.lastQuery = {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        ...this.lastQuery,
        ...query,
      };
      try {
        this.list = await client.get<PaginatedResult<Transaction>>(
          '/transactions',
          this.lastQuery as Record<string, unknown>,
        );
      } catch (err) {
        this.listError = (err as Error).message;
      } finally {
        this.listLoading = false;
      }
    },

    setPage(page: number) {
      return this.fetchList({ ...this.lastQuery, page });
    },

    /**
     * Changing the page size always snaps back to page 1 so users don't
     * land on an empty page after widening the window.
     */
    setPageSize(pageSize: number) {
      return this.fetchList({ ...this.lastQuery, pageSize, page: 1 });
    },

    async fetchById(id: string) {
      const client = useApiClient();
      this.detailLoading = true;
      this.detailError = null;
      try {
        const tx = await client.get<Transaction>(`/transactions/${id}`);
        this.byId[id] = tx;
        return tx;
      } catch (err) {
        this.detailError = (err as Error).message;
        throw err;
      } finally {
        this.detailLoading = false;
      }
    },

    async fetchStageHistory(id: string) {
      const client = useApiClient();
      const history = await client.get<TransactionStageHistory[]>(
        `/transactions/${id}/stage-history`,
      );
      this.stageHistoryByTx[id] = history;
      return history;
    },

    async fetchBreakdown(id: string) {
      const client = useApiClient();
      try {
        const breakdown = await client.get<CommissionBreakdown>(
          `/commissions/by-transaction/${id}`,
        );
        this.breakdownByTx[id] = breakdown;
        return breakdown;
      } catch (err) {
        const statusCode = (err as Error & { statusCode?: number }).statusCode;
        if (statusCode === 404) {
          this.breakdownByTx[id] = null;
          return null;
        }
        throw err;
      }
    },

    async create(payload: {
      propertyTitle: string;
      propertyAddress: string;
      transactionType: 'sale' | 'rent';
      totalServiceFee: number;
      currency?: string;
      listingAgentId: string;
      sellingAgentId: string;
      agreementDate?: string;
      notes?: string;
    }) {
      const client = useApiClient();
      const tx = await client.post<Transaction>('/transactions', payload);
      this.byId[tx.id] = tx;
      this.list = null;
      return tx;
    },

    async advanceStage(id: string, payload: {
      toStage: TransactionStage;
      reason?: string;
      triggeredBy?: string;
    }) {
      const client = useApiClient();
      const tx = await client.post<Transaction>(
        `/transactions/${id}/advance-stage`,
        payload,
      );
      this.byId[id] = tx;
      this.list = null;
      delete this.stageHistoryByTx[id];
      delete this.breakdownByTx[id];
      return tx;
    },
  },
});
