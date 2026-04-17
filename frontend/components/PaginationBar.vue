<script setup lang="ts">
/**
 * Presentational pagination control. Emits `update:page` so the parent
 * store/page keeps its own pagination state. Renders a concise
 * "Showing 1–20 of 47" summary alongside prev/next buttons.
 *
 * When `pageSizeOptions` is provided, also renders a "rows per page"
 * selector and emits `update:pageSize` when it changes.
 */
const props = withDefaults(
  defineProps<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    pageSizeOptions?: number[];
  }>(),
  {
    pageSizeOptions: () => [],
  },
);

const emit = defineEmits<{
  'update:page': [value: number];
  'update:pageSize': [value: number];
}>();

const from = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1,
);
const to = computed(() =>
  Math.min(props.total, props.page * props.pageSize),
);
const canPrev = computed(() => props.page > 1);
const canNext = computed(() => props.page < props.totalPages);
const showSizeSelector = computed(
  () => props.pageSizeOptions && props.pageSizeOptions.length > 1,
);

function onSizeChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value);
  if (Number.isFinite(value) && value > 0) {
    emit('update:pageSize', value);
  }
}
</script>

<template>
  <div
    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[color:var(--color-on-surface-variant)]"
  >
    <div class="flex items-center gap-4">
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
      <label v-if="showSizeSelector" class="flex items-center gap-2">
        <span class="hidden sm:inline">Rows</span>
        <select
          class="field-input !py-1 !px-2 !text-xs w-auto"
          :value="pageSize"
          @change="onSizeChange"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
      </label>
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
