<script setup lang="ts">
/**
 * Minimalist empty-state card. Keeps the "calm editorial" tone by
 * using generous vertical whitespace and a single, muted sentence
 * instead of illustrations.
 */
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="text-center py-12 px-6">
    <div
      class="mx-auto w-12 h-12 rounded-[var(--radius-md)] bg-[color:var(--color-surface-container-high)] flex items-center justify-center text-[color:var(--color-on-surface-variant)]"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="w-5 h-5"
      >
        <path d="M3 7h18" />
        <path d="M6 12h12" />
        <path d="M9 17h6" />
      </svg>
    </div>
    <h3 class="font-display text-base font-bold text-[color:var(--color-primary)] mt-4">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="text-sm text-[color:var(--color-on-surface-variant)] mt-2 max-w-md mx-auto"
    >
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-5 flex justify-center">
      <slot />
    </div>
  </div>
</template>
