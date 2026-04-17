<script setup lang="ts">
/**
 * Fixed-position stack of active toasts. Rendered once in the root
 * layout; every component then pushes via `useToast()`.
 *
 * Colours are driven by the design system's semantic tokens so the
 * toast feels first-class with the rest of the operations console.
 */
const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed top-6 right-6 z-50 flex flex-col gap-3 w-[22rem] max-w-[calc(100vw-3rem)]"
      aria-live="polite"
      aria-atomic="true"
    >
      <TransitionGroup name="toast" tag="div" class="flex flex-col gap-3">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'ledger-card ledger-card--tight flex items-start gap-3 shadow-[var(--shadow-lift)]',
            toast.variant === 'error' ? 'border-l-4 border-[color:var(--color-error)]' : '',
            toast.variant === 'success' ? 'border-l-4 border-[color:var(--color-tertiary-fixed-dim)]' : '',
            toast.variant === 'info' ? 'border-l-4 border-[color:var(--color-secondary)]' : '',
          ]"
          role="status"
        >
          <div
            class="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[0.625rem] font-bold"
            :class="[
              toast.variant === 'error' ? 'bg-[color:var(--color-error-container)] text-[color:var(--color-error)]' : '',
              toast.variant === 'success' ? 'bg-[color:var(--color-tertiary-fixed)] text-[color:var(--color-tertiary-container)]' : '',
              toast.variant === 'info' ? 'bg-[color:var(--color-secondary-fixed)] text-[color:var(--color-secondary)]' : '',
            ]"
          >
            {{ toast.variant === 'error' ? '!' : toast.variant === 'success' ? '✓' : 'i' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-[color:var(--color-primary)]">
              {{ toast.title }}
            </div>
            <div
              v-if="toast.description"
              class="text-xs text-[color:var(--color-on-surface-variant)] mt-1 break-words"
            >
              {{ toast.description }}
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-primary)] text-lg leading-none"
            aria-label="Dismiss"
            @click="dismiss(toast.id)"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 200ms ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
