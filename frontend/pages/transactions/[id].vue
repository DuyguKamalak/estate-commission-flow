<script setup lang="ts">
import {
  TransactionStage,
  TRANSACTION_STAGE_LABEL,
  TRANSACTION_STAGE_ORDER,
} from '~/types/api';

const route = useRoute();
const transactions = useTransactionsStore();
const agents = useAgentsStore();
const toast = useToast();

useHead({ title: 'Transaction · Estate Commission Flow' });

const id = computed(() => String(route.params.id));

/*
 * Load the transaction, its stage history, any commission breakdown,
 * and the agent roster in parallel. `fetchBreakdown` gracefully
 * returns null when there isn't one yet (pre-completion), so we
 * don't have to branch on 404 here.
 */
async function loadAll() {
  await Promise.all([
    transactions.fetchById(id.value).catch(() => null),
    transactions.fetchStageHistory(id.value).catch(() => []),
    transactions.fetchBreakdown(id.value).catch(() => null),
    agents.list ? Promise.resolve() : agents.fetchList({ pageSize: 100 }),
  ]);
}

await useAsyncData(() => `tx-detail-${id.value}`, () => loadAll().then(() => true));

const tx = computed(() => transactions.byId[id.value] ?? null);
const history = computed(() => transactions.stageHistoryByTx[id.value] ?? []);
const breakdown = computed(() => transactions.breakdownByTx[id.value] ?? null);

const agentsById = computed(() => {
  const map: Record<string, import('~/types/api').Agent> = {};
  for (const a of agents.items) map[a.id] = a;
  return map;
});

function agentName(idValue?: string | null): string {
  if (!idValue) return '—';
  const a = agentsById.value[idValue];
  if (!a) return 'Unknown agent';
  return a.fullName ?? `${a.firstName} ${a.lastName}`;
}

function formatDate(iso?: string | null, withTime = false): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}

/**
 * The business rule only allows strict forward-one-step transitions,
 * so from a given current stage there is at most one valid `toStage`.
 * We surface that as the next-stage CTA.
 */
const nextStage = computed<TransactionStage | null>(() => {
  if (!tx.value) return null;
  const idx = TRANSACTION_STAGE_ORDER.indexOf(tx.value.stage);
  if (idx < 0 || idx >= TRANSACTION_STAGE_ORDER.length - 1) return null;
  return TRANSACTION_STAGE_ORDER[idx + 1];
});

const advancing = ref(false);
const advanceModalOpen = ref(false);
const advanceReason = ref('');
const advanceTriggeredBy = ref('');

function openAdvanceModal() {
  advanceReason.value = '';
  advanceTriggeredBy.value = '';
  advanceModalOpen.value = true;
}

async function confirmAdvance() {
  if (!tx.value || !nextStage.value) return;
  advancing.value = true;
  try {
    await transactions.advanceStage(tx.value.id, {
      toStage: nextStage.value,
      reason: advanceReason.value.trim() || undefined,
      triggeredBy: advanceTriggeredBy.value.trim() || undefined,
    });
    toast.success(
      'Stage advanced',
      `Transaction is now in ${TRANSACTION_STAGE_LABEL[nextStage.value]}.`,
    );
    advanceModalOpen.value = false;
    await loadAll();
  } catch (err) {
    toast.error('Could not advance stage', (err as Error).message);
  } finally {
    advancing.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      :eyebrow="tx?.referenceCode ?? 'Transaction'"
      :title="tx?.propertyTitle ?? 'Transaction detail'"
      :description="tx?.propertyAddress ?? 'Loading transaction details…'"
    >
      <template #actions>
        <NuxtLink to="/transactions" class="btn-tertiary text-sm">
          ← Ledger
        </NuxtLink>
        <button
          v-if="nextStage && tx"
          type="button"
          class="btn-primary text-sm"
          :disabled="advancing"
          @click="openAdvanceModal"
        >
          Advance to {{ TRANSACTION_STAGE_LABEL[nextStage] }}
        </button>
      </template>
    </PageHeader>

    <DataStateBoundary
      :loading="transactions.detailLoading && !tx"
      :error="transactions.detailError"
      :empty="!transactions.detailLoading && !tx"
      empty-title="Transaction not found"
      empty-description="The reference may have been renamed, or the record is no longer accessible."
      @retry="loadAll"
    >
      <template v-if="tx">
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <!-- Summary -->
          <div class="ledger-card lg:col-span-2">
            <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
              Summary
            </h3>
            <dl class="mt-5 grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-6 text-sm">
              <div>
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Stage
                </dt>
                <dd class="mt-1"><StageBadge :stage="tx.stage" /></dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Type
                </dt>
                <dd class="mt-1 capitalize text-[color:var(--color-primary)] font-semibold">
                  {{ tx.transactionType }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Service fee
                </dt>
                <dd class="mt-1">
                  <MoneyCell :value="tx.totalServiceFee" :currency="tx.currency" />
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Listing agent
                </dt>
                <dd class="mt-1 text-[color:var(--color-primary)] font-semibold">
                  {{ agentName(tx.listingAgentId) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Selling agent
                </dt>
                <dd class="mt-1 text-[color:var(--color-primary)] font-semibold">
                  {{ agentName(tx.sellingAgentId) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Agreement date
                </dt>
                <dd class="mt-1">{{ formatDate(tx.agreementDate) }}</dd>
              </div>
              <div v-if="tx.earnestMoneyDate">
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Earnest money
                </dt>
                <dd class="mt-1">{{ formatDate(tx.earnestMoneyDate) }}</dd>
              </div>
              <div v-if="tx.titleDeedDate">
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Title deed
                </dt>
                <dd class="mt-1">{{ formatDate(tx.titleDeedDate) }}</dd>
              </div>
              <div v-if="tx.completedAt">
                <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                  Completed
                </dt>
                <dd class="mt-1">{{ formatDate(tx.completedAt) }}</dd>
              </div>
            </dl>

            <div v-if="tx.notes" class="mt-6 pt-5">
              <div class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                Notes
              </div>
              <p class="mt-2 text-sm text-[color:var(--color-primary)] whitespace-pre-line">
                {{ tx.notes }}
              </p>
            </div>
          </div>

          <!-- Timeline -->
          <div class="ledger-card">
            <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
              Stage timeline
            </h3>
            <p class="text-xs text-[color:var(--color-on-surface-variant)] mt-1">
              Forward-only, one step at a time.
            </p>
            <div class="mt-6">
              <StageTimeline :transaction="tx" :history="history" />
            </div>
          </div>
        </section>

        <!-- Commission breakdown (completed only) -->
        <section v-if="tx.stage === TransactionStage.COMPLETED">
          <CommissionBreakdownCard
            v-if="breakdown"
            :breakdown="breakdown"
            :agents-by-id="agentsById"
          />
          <div v-else class="ledger-card">
            <EmptyState
              title="Breakdown not available"
              description="The commission snapshot should exist for a completed transaction — if you can see this, try refreshing."
            >
              <button type="button" class="btn-tertiary text-sm" @click="loadAll">
                Retry
              </button>
            </EmptyState>
          </div>
        </section>
      </template>
    </DataStateBoundary>

    <!-- Advance stage modal -->
    <ModalShell
      :open="advanceModalOpen"
      :title="`Advance to ${nextStage ? TRANSACTION_STAGE_LABEL[nextStage] : ''}`"
      description="Stage changes are recorded in the audit trail. Completed triggers the commission breakdown snapshot."
      @close="advanceModalOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="confirmAdvance">
        <FormField
          label="Reason"
          for="advance-reason"
          helper="Optional — appears in the stage history row."
        >
          <input
            id="advance-reason"
            v-model="advanceReason"
            type="text"
            class="field-input"
            maxlength="500"
            placeholder="e.g. Buyer signed title deed at Land Registry"
          >
        </FormField>

        <FormField
          label="Triggered by"
          for="advance-triggered-by"
          helper="Optional — name of the operator, or leave blank for system."
        >
          <input
            id="advance-triggered-by"
            v-model="advanceTriggeredBy"
            type="text"
            class="field-input"
            maxlength="120"
            placeholder="e.g. A. Operator"
          >
        </FormField>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="btn-tertiary text-sm"
            :disabled="advancing"
            @click="advanceModalOpen = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary text-sm"
            :disabled="advancing"
          >
            {{ advancing ? 'Advancing…' : 'Confirm' }}
          </button>
        </div>
      </form>
    </ModalShell>
  </div>
</template>
