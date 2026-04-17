<script setup lang="ts">
/**
 * Accessible modal shell. Renders a dimmed backdrop + centred card
 * with focus trapping kept simple (just closes on Esc and backdrop
 * click). Content is projected via the default slot so each caller
 * can own its form markup.
 *
 * We intentionally don't pull in a dialog library — the app only
 * needs a couple of modals, and the native `dialog` element has
 * awkward styling quirks we'd rather avoid at this stage.
 */
const props = defineProps<{
  open: boolean;
  title: string;
  description?: string;
}>();

const emit = defineEmits<{ close: [] }>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close');
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-40 flex items-start md:items-center justify-center p-4 bg-[color:var(--color-primary)]/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="emit('close')"
      >
        <div
          class="ledger-card w-full max-w-lg shadow-[var(--shadow-lift)] mt-10 md:mt-0"
          @click.stop
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="font-display text-xl font-bold text-[color:var(--color-primary)]">
                {{ title }}
              </h3>
              <p
                v-if="description"
                class="text-sm text-[color:var(--color-on-surface-variant)] mt-1"
              >
                {{ description }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 text-[color:var(--color-on-surface-variant)] hover:text-[color:var(--color-primary)] text-2xl leading-none -mt-1"
              aria-label="Close dialog"
              @click="emit('close')"
            >
              ×
            </button>
          </div>
          <div class="mt-5">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 160ms ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
