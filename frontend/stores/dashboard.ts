import { defineStore } from 'pinia';
import type { DashboardSnapshot } from '~/types/api';

/**
 * Holds the single payload returned by `GET /reports/dashboard`.
 *
 * We intentionally keep this thin: one fetch action, one piece of
 * state. The dashboard page polls (or re-calls on stage changes)
 * rather than maintaining its own derived state.
 */
export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    snapshot: null as DashboardSnapshot | null,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchSnapshot() {
      const client = useApiClient();
      this.loading = true;
      this.error = null;
      try {
        this.snapshot = await client.get<DashboardSnapshot>('/reports/dashboard');
      } catch (err) {
        this.error = (err as Error).message;
      } finally {
        this.loading = false;
      }
    },
  },
});
