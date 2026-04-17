<script setup lang="ts">
const route = useRoute();
const transactions = useTransactionsStore();

useHead({ title: 'Transaction · Estate Commission Flow' });

/*
 * Lightweight detail preview for Sprint 5 so the ledger row links
 * land on a real screen. The full detail experience — stage timeline,
 * financial breakdown, advance-stage CTA — arrives in Sprint 6.
 */
const id = computed(() => String(route.params.id));

await useAsyncData(
  () => `transaction-${id.value}`,
  async () => {
    await transactions.fetchById(id.value).catch(() => null);
    return true;
  },
);

const tx = computed(() => transactions.byId[id.value] ?? null);
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      :eyebrow="tx?.referenceCode ?? 'Transaction'"
      :title="tx?.propertyTitle ?? 'Transaction detail'"
      :description="tx?.propertyAddress ?? 'Loading…'"
    >
      <template #actions>
        <NuxtLink to="/transactions" class="btn-tertiary text-sm">
          ← Back to ledger
        </NuxtLink>
      </template>
    </PageHeader>

    <DataStateBoundary
      :loading="transactions.detailLoading && !tx"
      :error="transactions.detailError"
      :empty="!transactions.detailLoading && !tx"
      empty-title="Transaction not found"
      empty-description="The reference may have been renamed, or the record is no longer accessible."
      @retry="transactions.fetchById(id)"
    >
      <section v-if="tx" class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="ledger-card lg:col-span-2">
          <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
            Summary
          </h3>
          <dl class="mt-5 grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
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
                <MoneyCell
                  :value="tx.totalServiceFee"
                  :currency="tx.currency"
                />
              </dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
                Currency
              </dt>
              <dd class="mt-1 font-mono text-[color:var(--color-primary)]">
                {{ tx.currency }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="ledger-card">
          <h3 class="font-display text-base font-bold text-[color:var(--color-primary)]">
            Full experience coming in Sprint 6
          </h3>
          <p class="text-sm text-[color:var(--color-on-surface-variant)] mt-2">
            Stage timeline, advance-stage controls, and the live commission
            breakdown will appear here next sprint.
          </p>
        </div>
      </section>
    </DataStateBoundary>
  </div>
</template>
