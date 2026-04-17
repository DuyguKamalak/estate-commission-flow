<script setup lang="ts">
/**
 * Editorial-style page header. Left side holds the eyebrow, title,
 * and an optional supporting line; right side accepts actions via
 * the `actions` slot (e.g. "New transaction" button, filters).
 *
 * Designed for the "operations console" feel: calm, no dividers,
 * wide tracking on the eyebrow, Manrope display on the headline.
 */
defineProps<{
  eyebrow?: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <header class="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
    <div class="max-w-2xl">
      <div
        v-if="eyebrow"
        class="text-xs uppercase tracking-[0.12em] text-[color:var(--color-on-surface-variant)]"
      >
        {{ eyebrow }}
      </div>
      <h2
        class="font-display text-3xl md:text-4xl font-bold text-[color:var(--color-primary)] mt-1 leading-tight"
      >
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="text-sm text-[color:var(--color-on-surface-variant)] mt-2"
      >
        {{ description }}
      </p>
    </div>

    <div
      v-if="$slots.actions"
      class="flex items-center gap-2 shrink-0"
    >
      <slot name="actions" />
    </div>
  </header>
</template>
