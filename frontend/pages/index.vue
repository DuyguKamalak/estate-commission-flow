<script setup lang="ts">
import {
  TransactionStage,
  TRANSACTION_STAGE_LABEL,
  TRANSACTION_STAGE_ORDER,
} from '~/types/api';

useHead({ title: 'Dashboard · Estate Commission Flow' });

const dashboard = useDashboardStore();
const { formatMinor } = useCurrency();

/*
 * Fetch the single `/reports/dashboard` snapshot on mount. SSR-friendly
 * via `useAsyncData` so the server renders real numbers straight into
 * the HTML, avoiding a pop-in on cold loads.
 */
await useAsyncData('dashboard-snapshot', () => dashboard.fetchSnapshot());

const snapshot = computed(() => dashboard.snapshot);

/**
 * Four headline KPIs for the operations console. Keep the copy concise
 * — the dashboard's job is to let the user glance and move on.
 */
const kpis = computed(() => {
  const s = snapshot.value;
  return [
    {
      label: 'Active transactions',
      value: s ? String(s.activeTransactionsCount) : '—',
      meta: 'Not yet completed',
    },
    {
      label: 'Completed this month',
      value: s ? String(s.completedThisMonthCount) : '—',
      meta: 'Calendar month, UTC',
    },
    {
      label: 'Agency earnings (MTD)',
      value: s ? formatAgencyEarnings(s.agencyEarningsMtd) : '£—',
      meta: 'Sum of completed-stage agency shares',
    },
    {
      label: 'At title deed stage',
      value: s ? String(s.pendingTitleDeedCount) : '—',
      meta: 'In conveyancer review — next step is completion',
    },
  ];
});

/**
 * Stage distribution with a percentage relative to the total so the
 * bars are meaningful even when the absolute numbers differ wildly.
 */
const stageRows = computed(() => {
  const dist = snapshot.value?.stageDistribution;
  if (!dist) return [];
  const total =
    (dist[TransactionStage.AGREEMENT] ?? 0) +
    (dist[TransactionStage.EARNEST_MONEY] ?? 0) +
    (dist[TransactionStage.TITLE_DEED] ?? 0) +
    (dist[TransactionStage.COMPLETED] ?? 0);
  return TRANSACTION_STAGE_ORDER.map((stage) => ({
    stage,
    label: TRANSACTION_STAGE_LABEL[stage],
    count: dist[stage] ?? 0,
    percent: total === 0 ? 0 : Math.round(((dist[stage] ?? 0) / total) * 100),
  }));
});

const recent = computed(() => snapshot.value?.recentTransactions ?? []);

function formatAgencyEarnings(
  buckets: { currency: string; total: number }[],
): string {
  if (!buckets.length) return formatMinor(0);
  // Operations team works predominantly in GBP; if multiple currencies
  // show up we display the largest bucket and hint at the others.
  const [first, ...rest] = buckets;
  const head = formatMinor(first.total, first.currency);
  if (!rest.length) return head;
  return `${head} +${rest.length} more`;
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <PageHeader
      eyebrow="Overview"
      title="Welcome back"
      description="A calm, editorial view of every transaction in flight. Data is read live from the operations database."
    >
      <template #actions>
        <NuxtLink to="/transactions" class="btn-tertiary text-sm">
          Open ledger
        </NuxtLink>
        <button type="button" class="btn-primary text-sm" @click="dashboard.fetchSnapshot()">
          Refresh
        </button>
      </template>
    </PageHeader>

    <DataStateBoundary
      :loading="dashboard.loading && !snapshot"
      :error="dashboard.error"
      :empty="false"
      @retry="dashboard.fetchSnapshot()"
    >
      <!-- KPI row -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="ledger-card"
        >
          <div
            class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]"
          >
            {{ kpi.label }}
          </div>
          <div
            class="font-display text-3xl font-bold text-[color:var(--color-primary)] mt-4 tabular-nums"
          >
            {{ kpi.value }}
          </div>
          <div class="text-xs text-[color:var(--color-on-surface-variant)] mt-2">
            {{ kpi.meta }}
          </div>
        </div>
      </section>

      <!-- Recent + distribution -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        <div class="ledger-card lg:col-span-2">
          <div class="flex items-center justify-between">
            <h3
              class="font-display text-lg font-bold text-[color:var(--color-primary)]"
            >
              Recent transactions
            </h3>
            <NuxtLink to="/transactions" class="btn-tertiary text-sm">
              View all
            </NuxtLink>
          </div>

          <div v-if="recent.length === 0" class="mt-6">
            <EmptyState
              title="No transactions yet"
              description="Once the operations team books a new deal, it will appear here in real time."
            />
          </div>
          <div v-else class="mt-5 divide-y divide-[color:var(--color-surface-container)]">
            <NuxtLink
              v-for="tx in recent"
              :key="tx.id"
              :to="`/transactions/${tx.id}`"
              class="flex items-center justify-between py-3 -mx-2 px-2 rounded-[var(--radius-md)] hover:bg-[color:var(--color-surface-container-low)] transition-colors"
            >
              <div class="min-w-0">
                <div
                  class="text-sm font-semibold text-[color:var(--color-primary)] truncate"
                >
                  {{ tx.propertyTitle }}
                </div>
                <div
                  class="text-xs text-[color:var(--color-on-surface-variant)] font-mono mt-0.5"
                >
                  {{ tx.referenceCode }}
                </div>
              </div>
              <div class="flex items-center gap-4 shrink-0">
                <MoneyCell
                  :value="tx.totalServiceFee"
                  :currency="tx.currency"
                  tabular
                />
                <StageBadge :stage="tx.stage" compact />
              </div>
            </NuxtLink>
          </div>
        </div>

        <div class="ledger-card">
          <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
            Stage distribution
          </h3>
          <div class="mt-6 space-y-4">
            <div
              v-for="row in stageRows"
              :key="row.stage"
              class="flex flex-col gap-1.5"
            >
              <div class="flex items-center justify-between text-sm">
                <StageBadge :stage="row.stage" compact />
                <span
                  class="text-[color:var(--color-primary)] font-semibold tabular-nums"
                >
                  {{ row.count }}
                  <span
                    class="text-xs text-[color:var(--color-on-surface-variant)] ml-1"
                  >
                    · {{ row.percent }}%
                  </span>
                </span>
              </div>
              <div
                class="h-1.5 bg-[color:var(--color-surface-container-high)] rounded-full overflow-hidden"
              >
                <div
                  class="h-full rounded-full transition-all"
                  :class="[
                    row.stage === TransactionStage.AGREEMENT
                      ? 'bg-[color:var(--color-stage-agreement-fg)]'
                      : row.stage === TransactionStage.EARNEST_MONEY
                        ? 'bg-[color:var(--color-stage-earnest-fg)]'
                        : row.stage === TransactionStage.TITLE_DEED
                          ? 'bg-[color:var(--color-stage-titledeed-fg)]'
                          : 'bg-[color:var(--color-stage-completed-fg)]',
                  ]"
                  :style="{ width: `${row.percent}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </DataStateBoundary>
  </div>
</template>
