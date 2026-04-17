import { defineStore } from 'pinia';
import type {
  CommissionsReport,
  CommissionsReportFilters,
  DashboardSnapshot,
} from '~/types/api';

/**
 * Holds the two reporting payloads:
 *   - the dashboard snapshot (`GET /reports/dashboard`),
 *   - the filtered commissions report (`GET /reports/commissions`).
 *
 * The commissions report replaces the previous result on each fetch
 * because filters are the primary interaction — caching by filter
 * key would waste memory on a screen where the operator typically
 * sweeps through date ranges linearly.
 */
export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    snapshot: null as DashboardSnapshot | null,
    loading: false,
    error: null as string | null,

    report: null as CommissionsReport | null,
    reportLoading: false,
    reportError: null as string | null,
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

    async fetchCommissionsReport(filters: CommissionsReportFilters = {}) {
      const client = useApiClient();
      this.reportLoading = true;
      this.reportError = null;
      try {
        this.report = await client.get<CommissionsReport>(
          '/reports/commissions',
          filters as Record<string, unknown>,
        );
      } catch (err) {
        this.reportError = (err as Error).message;
      } finally {
        this.reportLoading = false;
      }
    },
  },
});
