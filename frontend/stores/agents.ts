import { defineStore } from 'pinia';
import type { Agent, ListAgentsQuery, PaginatedResult } from '~/types/api';

const DEFAULT_PAGE_SIZE = 50;

/**
 * Agents store.
 *
 * The agent list is typically small (a single agency's roster) so we
 * keep the full list in memory after the first fetch and let
 * individual pages filter client-side when that's cheaper than a
 * round-trip.
 */
export const useAgentsStore = defineStore('agents', {
  state: () => ({
    list: null as PaginatedResult<Agent> | null,
    listLoading: false,
    listError: null as string | null,
    lastQuery: { page: 1, pageSize: DEFAULT_PAGE_SIZE } as ListAgentsQuery,

    byId: {} as Record<string, Agent>,
  }),

  getters: {
    items: (state): Agent[] => state.list?.items ?? [],
    activeAgents(state): Agent[] {
      return (state.list?.items ?? []).filter((a) => a.isActive);
    },
  },

  actions: {
    async fetchList(query: ListAgentsQuery = {}) {
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
        this.list = await client.get<PaginatedResult<Agent>>(
          '/agents',
          this.lastQuery as Record<string, unknown>,
        );
        for (const agent of this.list.items) {
          this.byId[agent.id] = agent;
        }
      } catch (err) {
        this.listError = (err as Error).message;
      } finally {
        this.listLoading = false;
      }
    },

    async create(payload: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    }) {
      const client = useApiClient();
      const agent = await client.post<Agent>('/agents', payload);
      this.byId[agent.id] = agent;
      this.list = null;
      return agent;
    },

    async deactivate(id: string) {
      const client = useApiClient();
      await client.del<void>(`/agents/${id}`);
      if (this.byId[id]) this.byId[id] = { ...this.byId[id], isActive: false };
      this.list = null;
    },
  },
});
