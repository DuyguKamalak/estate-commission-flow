<script setup lang="ts">
import {
  TransactionStage,
  TRANSACTION_STAGE_LABEL,
  TRANSACTION_STAGE_ORDER,
  type Transaction,
  type TransactionStageHistory,
} from '~/types/api';

/**
 * Visual timeline of the four-stage lifecycle.
 * Each stage cell shows three things:
 *   - the label (e.g. "Agreement"),
 *   - the date the transaction entered that stage (from history or
 *     the transaction's stage-date fields),
 *   - and, for past/current stages, the optional reason / who.
 *
 * Past stages are rendered in full colour; the active stage gets a
 * pulsing dot; future stages are dimmed so the user's eye lands on
 * "where are we now" immediately.
 */
const props = defineProps<{
  transaction: Transaction;
  history: TransactionStageHistory[];
}>();

const currentIndex = computed(() =>
  TRANSACTION_STAGE_ORDER.indexOf(props.transaction.stage),
);

/**
 * For each stage, find the `TransactionStageHistory` row where
 * `toStage` matches. The create-time entry has `fromStage: null`
 * and `toStage: AGREEMENT`, so it provides the agreement timestamp.
 */
const stageEntries = computed(() =>
  TRANSACTION_STAGE_ORDER.map((stage, idx) => {
    const entry = props.history.find((h) => h.toStage === stage);
    const status: 'past' | 'active' | 'future' =
      idx < currentIndex.value
        ? 'past'
        : idx === currentIndex.value
          ? 'active'
          : 'future';
    return {
      stage,
      label: TRANSACTION_STAGE_LABEL[stage],
      entry,
      status,
    };
  }),
);

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
</script>

<template>
  <ol class="relative flex flex-col gap-5">
    <li
      v-for="(row, idx) in stageEntries"
      :key="row.stage"
      class="relative flex gap-4"
    >
      <!-- Vertical connector (skip the last row). -->
      <span
        v-if="idx < stageEntries.length - 1"
        class="absolute left-[0.6875rem] top-6 bottom-[-1.25rem] w-px"
        :class="[
          row.status === 'past'
            ? 'bg-[color:var(--color-tertiary-fixed-dim)]'
            : 'bg-[color:var(--color-surface-container-high)]',
        ]"
        aria-hidden="true"
      />

      <!-- Stage node. -->
      <span
        class="relative z-10 mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center"
        :class="[
          row.status === 'past'
            ? 'bg-[color:var(--color-tertiary-fixed-dim)] text-[color:var(--color-on-tertiary)]'
            : row.status === 'active'
              ? 'bg-[color:var(--color-secondary)] text-[color:var(--color-on-secondary)] ring-4 ring-[color:var(--color-secondary-fixed)]'
              : 'bg-[color:var(--color-surface-container-high)] text-[color:var(--color-on-surface-variant)]',
        ]"
      >
        <span v-if="row.status === 'past'" class="text-[0.625rem] font-bold">✓</span>
        <span v-else-if="row.status === 'active'" class="w-1.5 h-1.5 rounded-full bg-[color:var(--color-on-secondary)] animate-pulse" />
        <span v-else class="text-[0.625rem] font-semibold">{{ idx + 1 }}</span>
      </span>

      <!-- Stage body. -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span
            class="text-sm font-semibold"
            :class="
              row.status === 'future'
                ? 'text-[color:var(--color-on-surface-variant)]'
                : 'text-[color:var(--color-primary)]'
            "
          >
            {{ row.label }}
          </span>
          <StageBadge
            v-if="row.status === 'active'"
            :stage="row.stage"
            compact
          />
        </div>
        <div class="text-xs text-[color:var(--color-on-surface-variant)] mt-1">
          {{ formatDate(row.entry?.changedAt) }}
        </div>
        <div
          v-if="row.entry?.reason"
          class="text-xs text-[color:var(--color-on-surface-variant)] mt-0.5 italic"
        >
          “{{ row.entry.reason }}”
        </div>
      </div>
    </li>
  </ol>
</template>
