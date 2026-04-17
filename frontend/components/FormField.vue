<script setup lang="ts">
/**
 * Label + input wrapper with optional helper text and inline error.
 *
 * We keep the actual input as a slot so consumers can project
 * `<input>`, `<select>`, or `<textarea>` with their own attributes —
 * the wrapper only owns the label, spacing, and error colour.
 */
defineProps<{
  label: string;
  /** Optional id linking `<label for>` to the input. */
  for?: string;
  required?: boolean;
  helper?: string;
  error?: string | null;
}>();
</script>

<template>
  <label :for="$props.for" class="flex flex-col gap-1.5">
    <span
      class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]"
    >
      {{ label }}
      <span v-if="required" class="text-[color:var(--color-error)]">*</span>
    </span>

    <slot />

    <span
      v-if="error"
      class="text-xs text-[color:var(--color-error)]"
    >
      {{ error }}
    </span>
    <span
      v-else-if="helper"
      class="text-xs text-[color:var(--color-on-surface-variant)]"
    >
      {{ helper }}
    </span>
  </label>
</template>
