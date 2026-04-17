<script setup lang="ts">
/**
 * Renders a monetary value transported from the API as an integer in
 * minor units (e.g. pence). Uses `useCurrency` so formatting stays
 * consistent across every screen.
 *
 * Usage: `<MoneyCell :value="tx.totalServiceFee" :currency="tx.currency" />`
 */
const props = withDefaults(
  defineProps<{
    value: number | null | undefined;
    currency?: string;
    /** If true, applies a monospaced, right-aligned treatment for tables. */
    tabular?: boolean;
  }>(),
  { currency: 'GBP', tabular: false },
);

const { formatMinor } = useCurrency();
const formatted = computed(() => formatMinor(props.value, props.currency));
</script>

<template>
  <span
    :class="[
      'font-semibold text-[color:var(--color-primary)]',
      tabular ? 'font-mono tabular-nums' : '',
    ]"
  >
    {{ formatted }}
  </span>
</template>
