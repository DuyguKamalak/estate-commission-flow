<script setup lang="ts">
import { TRANSACTION_STAGE_LABEL } from '~/types/api';

useHead({ title: 'Reports · Estate Commission Flow' });

const dashboardStore = useDashboardStore();
const agents = useAgentsStore();
const { formatMinor } = useCurrency();
const toast = useToast();
const runtime = useRuntimeConfig();

/*
 * Default the report window to the current month so the operator
 * sees a meaningful result immediately. Both inputs are HTML `date`
 * so we work with the simple YYYY-MM-DD format; the backend accepts
 * ISO 8601 and treats a plain date as UTC midnight.
 *
 * We explicitly append `T23:59:59Z` to the upper bound so the end
 * of the day is included — otherwise `to=2026-04-30` would exclude
 * anything calculated later that same day.
 */
function startOfMonthISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const filters = reactive({
  from: startOfMonthISO(),
  to: todayISO(),
  agentId: '',
  currency: '',
});

const effectiveFilters = computed(() => ({
  from: filters.from ? `${filters.from}T00:00:00.000Z` : undefined,
  to: filters.to ? `${filters.to}T23:59:59.999Z` : undefined,
  agentId: filters.agentId || undefined,
  currency: filters.currency.trim().toUpperCase() || undefined,
}));

async function loadReport() {
  await dashboardStore.fetchCommissionsReport(effectiveFilters.value);
}

await useAsyncData('reports-bootstrap', async () => {
  await Promise.all([
    agents.list ? Promise.resolve() : agents.fetchList({ pageSize: 100 }),
    loadReport(),
  ]);
  return true;
});

function onFilterSubmit() {
  loadReport().catch((err) => toast.error('Could not load report', (err as Error).message));
}

function resetFilters() {
  filters.from = startOfMonthISO();
  filters.to = todayISO();
  filters.agentId = '';
  filters.currency = '';
  loadReport();
}

/*
 * CSV export: we build the URL with the same filters and let the
 * browser handle the download. Because the backend sets a
 * `Content-Disposition: attachment` header, a simple anchor click
 * is enough — no need to stream the response through JavaScript.
 */
function csvUrl(): string {
  const base = runtime.public.apiBaseUrl ?? 'http://localhost:3001/api';
  const params = new URLSearchParams();
  const f = effectiveFilters.value;
  if (f.from) params.set('from', f.from);
  if (f.to) params.set('to', f.to);
  if (f.agentId) params.set('agentId', f.agentId);
  if (f.currency) params.set('currency', f.currency);
  const qs = params.toString();
  return `${base}/reports/commissions.csv${qs ? `?${qs}` : ''}`;
}

const report = computed(() => dashboardStore.report);

/*
 * For the horizontal bar chart we normalise each agent's totalShare
 * against the largest share in its currency bucket, so the bars stay
 * visually meaningful even when currencies mix.
 */
const topAgentByCurrency = computed(() => {
  const map = new Map<string, number>();
  for (const row of report.value?.agentTotals ?? []) {
    const prev = map.get(row.currency) ?? 0;
    if (row.totalShare > prev) map.set(row.currency, row.totalShare);
  }
  return map;
});

function barWidth(row: { currency: string; totalShare: number }): string {
  const top = topAgentByCurrency.value.get(row.currency) ?? 0;
  if (!top) return '0%';
  return `${Math.max(3, Math.round((row.totalShare / top) * 100))}%`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

const activeAgents = computed(() =>
  agents.items.filter((a) => a.isActive || a.id === filters.agentId),
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Reports"
      title="Commissions analytics"
      description="Filter by date, agent, and currency; the totals, agent leaderboard, and ledger all update from a single backend call. Export a CSV snapshot for spreadsheets."
    >
      <template #actions>
        <a
          :href="csvUrl()"
          class="btn-tertiary text-sm"
          target="_blank"
          rel="noopener"
          download
        >
          Download CSV
        </a>
      </template>
    </PageHeader>

    <!-- Filter bar -->
    <form
      class="ledger-card flex flex-wrap items-end gap-4"
      @submit.prevent="onFilterSubmit"
    >
      <FormField label="From" for="rep-from" class="flex-1 min-w-[9rem]">
        <input
          id="rep-from"
          v-model="filters.from"
          type="date"
          class="field-input"
        >
      </FormField>
      <FormField label="To" for="rep-to" class="flex-1 min-w-[9rem]">
        <input
          id="rep-to"
          v-model="filters.to"
          type="date"
          class="field-input"
        >
      </FormField>
      <FormField label="Agent" for="rep-agent" class="flex-1 min-w-[12rem]">
        <select id="rep-agent" v-model="filters.agentId" class="field-input">
          <option value="">All agents</option>
          <option v-for="a in activeAgents" :key="a.id" :value="a.id">
            {{ a.fullName ?? `${a.firstName} ${a.lastName}` }}
          </option>
        </select>
      </FormField>
      <FormField label="Currency" for="rep-currency" class="w-28">
        <input
          id="rep-currency"
          v-model="filters.currency"
          type="text"
          minlength="3"
          maxlength="3"
          class="field-input uppercase font-mono"
          placeholder="GBP"
        >
      </FormField>

      <div class="flex items-center gap-2">
        <button type="button" class="btn-tertiary text-sm" @click="resetFilters">
          Reset
        </button>
        <button type="submit" class="btn-primary text-sm" :disabled="dashboardStore.reportLoading">
          {{ dashboardStore.reportLoading ? 'Loading…' : 'Apply filters' }}
        </button>
      </div>
    </form>

    <DataStateBoundary
      :loading="dashboardStore.reportLoading && !report"
      :error="dashboardStore.reportError"
      :empty="!dashboardStore.reportLoading && !!report && report.currencyTotals.length === 0"
      empty-title="No commissions in range"
      empty-description="Nothing was calculated between these dates. Try widening the window or clearing the agent / currency filter."
      @retry="loadReport"
    >
      <template v-if="report">
        <!-- Currency summary cards -->
        <section v-if="report.currencyTotals.length" class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            v-for="total in report.currencyTotals"
            :key="total.currency"
            class="ledger-card"
          >
            <div class="flex items-center justify-between">
              <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
                {{ total.currency }}
              </h3>
              <span class="text-xs text-[color:var(--color-on-surface-variant)]">
                {{ total.transactionCount }} deals
              </span>
            </div>
            <div class="mt-5 space-y-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-[color:var(--color-on-surface-variant)]">
                  Total service fee
                </span>
                <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                  {{ formatMinor(total.totalServiceFee, total.currency) }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[color:var(--color-on-surface-variant)]">Agency (50%)</span>
                <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                  {{ formatMinor(total.agencyShare, total.currency) }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[color:var(--color-on-surface-variant)]">Agent pool</span>
                <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                  {{ formatMinor(total.agentPool, total.currency) }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Agent leaderboard with bars -->
        <section class="ledger-card">
          <div class="flex items-center justify-between">
            <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
              Agent earnings
            </h3>
            <span class="text-xs text-[color:var(--color-on-surface-variant)]">
              {{ report.agentTotals.length }} rows · sorted by share
            </span>
          </div>
          <div
            v-if="!report.agentTotals.length"
            class="mt-4 text-sm text-[color:var(--color-on-surface-variant)]"
          >
            No agent earnings in this window.
          </div>
          <ul v-else class="mt-5 flex flex-col gap-4">
            <li
              v-for="row in report.agentTotals"
              :key="`${row.agentId}-${row.currency}`"
              class="flex flex-col gap-1.5"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-[color:var(--color-primary)] truncate">
                    {{ row.agentName }}
                  </div>
                  <div class="text-xs text-[color:var(--color-on-surface-variant)] truncate">
                    {{ row.agentEmail ?? '—' }} · {{ row.transactionCount }} deal(s)
                  </div>
                </div>
                <span class="font-mono font-semibold text-[color:var(--color-primary)] tabular-nums shrink-0">
                  {{ formatMinor(row.totalShare, row.currency) }}
                </span>
              </div>
              <div class="h-2 rounded-full bg-[color:var(--color-surface-container-high)] overflow-hidden">
                <div
                  class="h-full bg-[color:var(--color-secondary)] rounded-full transition-all duration-500"
                  :style="{ width: barWidth(row) }"
                />
              </div>
            </li>
          </ul>
        </section>

        <!-- Transaction ledger -->
        <section class="ledger-card">
          <div class="flex items-center justify-between">
            <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
              Completed deals
            </h3>
            <span class="text-xs text-[color:var(--color-on-surface-variant)]">
              Showing {{ report.transactions.length }} (newest first, capped at 500)
            </span>
          </div>
          <div v-if="!report.transactions.length" class="mt-4 text-sm text-[color:var(--color-on-surface-variant)]">
            No deals completed in this window.
          </div>
          <div v-else class="mt-5 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)] border-b border-[color:var(--color-surface-container)]">
                  <th class="py-2 pr-4 font-semibold">Reference</th>
                  <th class="py-2 pr-4 font-semibold">Property</th>
                  <th class="py-2 pr-4 font-semibold">Stage</th>
                  <th class="py-2 pr-4 font-semibold text-right">Total fee</th>
                  <th class="py-2 pr-4 font-semibold text-right">Agency</th>
                  <th class="py-2 pr-4 font-semibold text-right">Pool</th>
                  <th class="py-2 pr-4 font-semibold">Calculated</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[color:var(--color-surface-container)]">
                <tr
                  v-for="tx in report.transactions"
                  :key="tx.id"
                  class="hover:bg-[color:var(--color-surface-container-low)] cursor-pointer transition-colors"
                  @click="$router.push(`/transactions/${tx.id}`)"
                >
                  <td class="py-3 pr-4 font-mono text-[color:var(--color-primary)]">
                    {{ tx.referenceCode }}
                  </td>
                  <td class="py-3 pr-4 text-[color:var(--color-primary)] max-w-xs truncate">
                    {{ tx.propertyTitle }}
                  </td>
                  <td class="py-3 pr-4">
                    <span class="text-xs text-[color:var(--color-on-surface-variant)]">
                      {{ TRANSACTION_STAGE_LABEL[tx.stage] ?? tx.stage }}
                    </span>
                  </td>
                  <td class="py-3 pr-4 font-mono text-right tabular-nums text-[color:var(--color-primary)]">
                    {{ formatMinor(tx.totalServiceFee, tx.currency) }}
                  </td>
                  <td class="py-3 pr-4 font-mono text-right tabular-nums text-[color:var(--color-primary)]">
                    {{ formatMinor(tx.agencyShare, tx.currency) }}
                  </td>
                  <td class="py-3 pr-4 font-mono text-right tabular-nums text-[color:var(--color-primary)]">
                    {{ formatMinor(tx.agentPool, tx.currency) }}
                  </td>
                  <td class="py-3 pr-4 text-xs text-[color:var(--color-on-surface-variant)]">
                    {{ formatDate(tx.calculatedAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </DataStateBoundary>
  </div>
</template>
