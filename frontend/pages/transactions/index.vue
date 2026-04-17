<script setup lang="ts">
import {
  TransactionStage,
  TRANSACTION_STAGE_LABEL,
  TRANSACTION_STAGE_ORDER,
  TransactionType,
  type ListTransactionsQuery,
} from '~/types/api';

useHead({ title: 'Transactions · Estate Commission Flow' });

const transactions = useTransactionsStore();
const agents = useAgentsStore();

/*
 * Local filter state. Mirrors the `ListTransactionsQuery` shape; we
 * keep it local so the user can tweak multiple fields before applying
 * — the list only refetches when the "Apply" button (or Enter on the
 * search box) is pressed, avoiding a storm of requests.
 */
const filters = reactive<ListTransactionsQuery>({
  page: 1,
  pageSize: 20,
  search: '',
  stage: undefined,
  transactionType: undefined,
  anyAgentId: undefined,
});

const initialLoad = useAsyncData('transactions-list', async () => {
  await Promise.all([
    transactions.fetchList({ page: 1, pageSize: 20 }),
    agents.fetchList({ pageSize: 100 }),
  ]);
  return true;
});

const items = computed(() => transactions.items);
const total = computed(() => transactions.total);
const list = computed(() => transactions.list);

const agentNameById = computed(() => {
  const map: Record<string, string> = {};
  for (const a of agents.items) {
    map[a.id] = a.fullName ?? `${a.firstName} ${a.lastName}`;
  }
  return map;
});

function applyFilters() {
  transactions.fetchList({ ...filters, page: 1 });
}

function clearFilters() {
  filters.search = '';
  filters.stage = undefined;
  filters.transactionType = undefined;
  filters.anyAgentId = undefined;
  filters.page = 1;
  transactions.fetchList({ ...filters });
}

function onPageChange(page: number) {
  transactions.setPage(page);
}

/**
 * Format the ISO `createdAt` as a compact `DD MMM YYYY`. Using
 * `Intl.DateTimeFormat` keeps us in locale territory without pulling
 * in another dependency.
 */
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Ledger"
      title="Transactions"
      description="Every property deal in flight. Filter by stage, type, or agent to narrow the ledger."
    >
      <template #actions>
        <NuxtLink to="/transactions/new" class="btn-primary text-sm">
          New transaction
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- Filter panel -->
    <section class="ledger-card ledger-card--tight">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <label class="flex flex-col gap-1 lg:col-span-2">
          <span class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Search
          </span>
          <input
            v-model="filters.search"
            type="search"
            placeholder="Property title, address, or reference"
            class="field-input"
            @keydown.enter="applyFilters"
          >
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Stage
          </span>
          <select v-model="filters.stage" class="field-input">
            <option :value="undefined">All stages</option>
            <option
              v-for="stage in TRANSACTION_STAGE_ORDER"
              :key="stage"
              :value="stage"
            >
              {{ TRANSACTION_STAGE_LABEL[stage] }}
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Type
          </span>
          <select v-model="filters.transactionType" class="field-input">
            <option :value="undefined">Sale & rent</option>
            <option :value="TransactionType.SALE">Sale</option>
            <option :value="TransactionType.RENT">Rent</option>
          </select>
        </label>

        <label class="flex flex-col gap-1">
          <span class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Agent
          </span>
          <select v-model="filters.anyAgentId" class="field-input">
            <option :value="undefined">Any agent</option>
            <option
              v-for="agent in agents.items"
              :key="agent.id"
              :value="agent.id"
            >
              {{ agent.fullName ?? `${agent.firstName} ${agent.lastName}` }}
            </option>
          </select>
        </label>
      </div>

      <div class="flex items-center justify-end gap-2 mt-4">
        <button type="button" class="btn-tertiary text-sm" @click="clearFilters">
          Clear
        </button>
        <button type="button" class="btn-primary text-sm" @click="applyFilters">
          Apply filters
        </button>
      </div>
    </section>

    <!-- Results -->
    <section class="ledger-card">
      <DataStateBoundary
        :loading="transactions.listLoading && !list"
        :error="transactions.listError"
        :empty="!transactions.listLoading && items.length === 0"
        empty-title="No transactions match your filters"
        empty-description="Try clearing the search or widening the stage filter."
        @retry="applyFilters"
      >
        <template #emptyAction>
          <button type="button" class="btn-tertiary text-sm" @click="clearFilters">
            Clear filters
          </button>
        </template>

        <div class="overflow-x-auto -mx-6">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
              <tr>
                <th class="py-3 px-6 font-medium">Property</th>
                <th class="py-3 px-6 font-medium">Reference</th>
                <th class="py-3 px-6 font-medium">Stage</th>
                <th class="py-3 px-6 font-medium">Type</th>
                <th class="py-3 px-6 font-medium">Listing agent</th>
                <th class="py-3 px-6 font-medium text-right">Service fee</th>
                <th class="py-3 px-6 font-medium">Agreed</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tx in items"
                :key="tx.id"
                class="hover:bg-[color:var(--color-surface-container-low)] cursor-pointer transition-colors"
                @click="navigateTo(`/transactions/${tx.id}`)"
              >
                <td class="py-3 px-6">
                  <div class="font-semibold text-[color:var(--color-primary)]">
                    {{ tx.propertyTitle }}
                  </div>
                  <div class="text-xs text-[color:var(--color-on-surface-variant)] truncate max-w-xs">
                    {{ tx.propertyAddress }}
                  </div>
                </td>
                <td class="py-3 px-6 font-mono text-xs text-[color:var(--color-on-surface-variant)]">
                  {{ tx.referenceCode }}
                </td>
                <td class="py-3 px-6">
                  <StageBadge :stage="tx.stage" compact />
                </td>
                <td class="py-3 px-6 capitalize">{{ tx.transactionType }}</td>
                <td class="py-3 px-6 text-[color:var(--color-on-surface-variant)]">
                  {{ agentNameById[tx.listingAgentId] ?? '—' }}
                </td>
                <td class="py-3 px-6 text-right">
                  <MoneyCell
                    :value="tx.totalServiceFee"
                    :currency="tx.currency"
                    tabular
                  />
                </td>
                <td class="py-3 px-6 text-[color:var(--color-on-surface-variant)]">
                  {{ formatDate(tx.agreementDate) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-5 pt-4">
          <PaginationBar
            v-if="list"
            :page="list.page"
            :page-size="list.pageSize"
            :total="list.total"
            :total-pages="list.totalPages"
            @update:page="onPageChange"
          />
        </div>
      </DataStateBoundary>
    </section>
  </div>
</template>
