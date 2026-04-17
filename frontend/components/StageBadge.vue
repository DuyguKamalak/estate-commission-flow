<script setup lang="ts">
import {
  TransactionStage,
  TRANSACTION_STAGE_LABEL,
} from '~/types/api';

/**
 * Stage chip. Colours come from the design system's stage tokens
 * (see `main.css` → `--color-stage-*`). Accepts either the canonical
 * enum value or a free-form string; unknown values fall back to a
 * neutral "outline" style rather than throwing, since the stage enum
 * may grow server-side before the frontend rebuilds.
 */
const props = defineProps<{
  stage: TransactionStage | string;
  /** When true, renders at a smaller size for inline tables. */
  compact?: boolean;
}>();

const classes = computed(() => {
  switch (props.stage) {
    case TransactionStage.AGREEMENT:
      return 'badge badge--agreement';
    case TransactionStage.EARNEST_MONEY:
      return 'badge badge--earnest';
    case TransactionStage.TITLE_DEED:
      return 'badge badge--titledeed';
    case TransactionStage.COMPLETED:
      return 'badge badge--completed';
    default:
      return 'badge';
  }
});

const label = computed(() => {
  if ((Object.values(TransactionStage) as string[]).includes(props.stage)) {
    return TRANSACTION_STAGE_LABEL[props.stage as TransactionStage];
  }
  return String(props.stage).replace(/_/g, ' ');
});
</script>

<template>
  <span :class="[classes, compact ? 'badge--compact' : '']">
    <span
      class="h-1.5 w-1.5 rounded-full bg-current opacity-70"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>

<style scoped>
.badge--compact {
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
}
</style>
