<script setup lang="ts">
/**
 * Presentational pagination control. Emits `update:page` so the parent
 * store/page keeps its own pagination state. Renders a concise
 * "Showing 1–20 of 47" summary alongside prev/next buttons.
 */
const props = defineProps<{
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>();

const emit = defineEmits<{
  'update:page': [value: number];
}>();

const from = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1,
);
const to = computed(() =>
  Math.min(props.total, props.page * props.pageSize),
);
const canPrev = computed(() => props.page > 1);
const canNext = computed(() => props.page < props.totalPages);
</script>

<template>
  <div
    class="flex items-center justify-between text-xs text-[color:var(--color-on-surface-variant)]"
  >
    <div>
      <template v-if="total === 0">No records</template>
      <template v-else>
        Showing
        <span class="font-semibold text-[color:var(--color-primary)]">
          {{ from }}–{{ to }}
        </span>
        of
        <span class="font-semibold text-[color:var(--color-primary)]">
          {{ total }}
        </span>
      </template>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn-tertiary text-xs"
        :disabled="!canPrev"
        :class="{ 'opacity-40 cursor-not-allowed': !canPrev }"
        @click="canPrev && emit('update:page', page - 1)"
      >
        ← Previous
      </button>
      <span class="text-[color:var(--color-on-surface-variant)]">
        Page {{ page }} of {{ Math.max(1, totalPages) }}
      </span>
      <button
        type="button"
        class="btn-tertiary text-xs"
        :disabled="!canNext"
        :class="{ 'opacity-40 cursor-not-allowed': !canNext }"
        @click="canNext && emit('update:page', page + 1)"
      >
        Next →
      </button>
    </div>
  </div>
</template>
