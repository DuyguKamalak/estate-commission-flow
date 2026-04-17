<script setup lang="ts">
/**
 * Thin sandwich around a data-driven slot that renders the right
 * thing for the three canonical async states:
 *
 *   - `loading` → skeletons (rendered by caller via #loading slot,
 *     or a neutral pulse if none is provided),
 *   - `error`   → muted error card with retry CTA,
 *   - `empty`   → `<EmptyState>` with caller-provided copy,
 *   - otherwise → default slot (the actual content).
 *
 * Centralising this keeps every page consistent and means we only
 * have one place to tweak the error UX later.
 */
defineProps<{
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div>
    <template v-if="loading">
      <slot name="loading">
        <div class="space-y-3">
          <div class="h-4 w-1/3 bg-[color:var(--color-surface-container-high)] rounded animate-pulse" />
          <div class="h-4 w-2/3 bg-[color:var(--color-surface-container-high)] rounded animate-pulse" />
          <div class="h-4 w-1/2 bg-[color:var(--color-surface-container-high)] rounded animate-pulse" />
        </div>
      </slot>
    </template>

    <template v-else-if="error">
      <div class="py-10 text-center">
        <div class="font-display text-base font-bold text-[color:var(--color-error)]">
          Something went wrong
        </div>
        <p class="text-sm text-[color:var(--color-on-surface-variant)] mt-2 max-w-md mx-auto">
          {{ error }}
        </p>
        <button
          type="button"
          class="btn-tertiary text-sm mt-4"
          @click="emit('retry')"
        >
          Retry
        </button>
      </div>
    </template>

    <template v-else-if="empty">
      <EmptyState
        :title="emptyTitle ?? 'Nothing to show yet'"
        :description="emptyDescription"
      >
        <slot name="emptyAction" />
      </EmptyState>
    </template>

    <template v-else>
      <slot />
    </template>
  </div>
</template>
