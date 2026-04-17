<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Agent, Transaction } from '~/types/api';

/**
 * Global command palette (Cmd/Ctrl+K).
 *
 * Provides a single keyboard-first entry point for:
 *   - Navigating to the main pages,
 *   - Jumping to any transaction by property title / address / reference,
 *   - Jumping to any agent by name or email.
 *
 * Debounces the search so we don't hammer the API, runs the two
 * backend calls in parallel, and collapses results into a single
 * keyboard-navigable list (↑/↓ + Enter, Esc to dismiss).
 */

const open = ref(false);
const query = ref('');
const activeIndex = ref(0);
const router = useRouter();
const route = useRoute();
const client = useApiClient();

const pages: Array<{ label: string; to: string; hint: string }> = [
  { label: 'Dashboard', to: '/', hint: 'Overview & KPIs' },
  { label: 'Transactions', to: '/transactions', hint: 'Ledger of every deal' },
  { label: 'Agents', to: '/agents', hint: 'Directory' },
  { label: 'Reports', to: '/reports', hint: 'Commissions analytics' },
  { label: 'New transaction', to: '/transactions/new', hint: 'Book a new deal' },
  { label: 'Settings', to: '/settings', hint: 'App info' },
];

const txResults = ref<Transaction[]>([]);
const agentResults = ref<Agent[]>([]);
const loading = ref(false);

/* ---------------- Keyboard + open/close ---------------- */

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

function onGlobalKeydown(event: KeyboardEvent) {
  const isToggle =
    (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
  if (isToggle) {
    event.preventDefault();
    openPalette();
    return;
  }
  if (!open.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closePalette();
  }
}

function openPalette() {
  open.value = true;
  query.value = '';
  activeIndex.value = 0;
  txResults.value = [];
  agentResults.value = [];
  nextTick(() => {
    const input = document.getElementById('command-palette-input');
    (input as HTMLInputElement | null)?.focus();
  });
}

function closePalette() {
  open.value = false;
}

defineExpose({ openPalette });

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
});

watch(
  () => route.fullPath,
  () => {
    closePalette();
  },
);

/* ---------------- Search ---------------- */

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(query, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  const trimmed = value.trim();
  if (!trimmed) {
    txResults.value = [];
    agentResults.value = [];
    loading.value = false;
    activeIndex.value = 0;
    return;
  }
  loading.value = true;
  debounceTimer = setTimeout(() => runSearch(trimmed), 180);
});

async function runSearch(term: string) {
  try {
    const [txPage, agentPage] = await Promise.all([
      client.get<{ items: Transaction[] }>('/transactions', {
        search: term,
        pageSize: 6,
      }),
      client.get<{ items: Agent[] }>('/agents', {
        search: term,
        pageSize: 6,
      }),
    ]);
    txResults.value = txPage.items ?? [];
    agentResults.value = agentPage.items ?? [];
    activeIndex.value = 0;
  } catch {
    // Silent fail — palette stays usable for page navigation even
    // when the API is down; the user sees "No results" instead.
    txResults.value = [];
    agentResults.value = [];
  } finally {
    loading.value = false;
  }
}

/* ---------------- Flat result list for keyboard nav ---------------- */

type Row =
  | { kind: 'page'; id: string; label: string; hint: string; to: string }
  | { kind: 'tx'; id: string; label: string; hint: string; to: string }
  | { kind: 'agent'; id: string; label: string; hint: string; to: string };

const filteredPages = computed<Row[]>(() => {
  const term = query.value.trim().toLowerCase();
  const base = term
    ? pages.filter((p) => p.label.toLowerCase().includes(term))
    : pages;
  return base.map((p) => ({
    kind: 'page',
    id: `page-${p.to}`,
    label: p.label,
    hint: p.hint,
    to: p.to,
  }));
});

const txRows = computed<Row[]>(() =>
  txResults.value.map((t) => ({
    kind: 'tx',
    id: `tx-${t.id}`,
    label: t.propertyTitle,
    hint: `${t.referenceCode} · ${t.propertyAddress}`,
    to: `/transactions/${t.id}`,
  })),
);

const agentRows = computed<Row[]>(() =>
  agentResults.value.map((a) => ({
    kind: 'agent',
    id: `agent-${a.id}`,
    label: a.fullName ?? `${a.firstName} ${a.lastName}`,
    hint: a.email,
    to: '/agents',
  })),
);

const allRows = computed<Row[]>(() => [
  ...filteredPages.value,
  ...txRows.value,
  ...agentRows.value,
]);

function isActive(index: number, kindRows: Row[]): boolean {
  const flatIndex = allRows.value.indexOf(kindRows[index]);
  return flatIndex === activeIndex.value;
}

function moveActive(delta: number) {
  const total = allRows.value.length;
  if (total === 0) return;
  activeIndex.value = (activeIndex.value + delta + total) % total;
}

function selectActive() {
  const row = allRows.value[activeIndex.value];
  if (!row) return;
  router.push(row.to);
  closePalette();
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveActive(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveActive(-1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    selectActive();
  }
}

function onRowClick(row: Row) {
  router.push(row.to);
  closePalette();
}

const showEmpty = computed(
  () =>
    !loading.value &&
    query.value.trim().length > 0 &&
    allRows.value.length === 0,
);
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20 sm:pt-28">
    <button
      type="button"
      class="absolute inset-0 bg-black/40"
      aria-label="Close command palette"
      @click="closePalette"
    />
    <div
      class="relative w-full max-w-xl bg-[color:var(--color-surface-container-lowest)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden"
      role="dialog"
      aria-label="Command palette"
    >
      <div class="flex items-center gap-3 border-b border-[color:var(--color-surface-container)] px-4 py-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[color:var(--color-on-surface-variant)]"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          id="command-palette-input"
          v-model="query"
          type="search"
          autocomplete="off"
          placeholder="Search transactions, agents, or jump to a page…"
          class="flex-1 bg-transparent text-sm text-[color:var(--color-primary)] placeholder:text-[color:var(--color-on-surface-variant)] focus:outline-none"
          @keydown="onInputKeydown"
        >
        <kbd class="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[color:var(--color-surface-container-high)] text-[color:var(--color-on-surface-variant)]">
          Esc
        </kbd>
      </div>

      <div class="max-h-96 overflow-y-auto py-2">
        <div v-if="loading" class="px-4 py-3 text-xs text-[color:var(--color-on-surface-variant)]">
          Searching…
        </div>

        <template v-if="filteredPages.length">
          <div class="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Pages
          </div>
          <button
            v-for="(row, i) in filteredPages"
            :key="row.id"
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors"
            :class="isActive(i, filteredPages) ? 'bg-[color:var(--color-surface-container-high)]' : 'hover:bg-[color:var(--color-surface-container-low)]'"
            @click="onRowClick(row)"
            @mouseenter="activeIndex = allRows.indexOf(row)"
          >
            <div class="min-w-0">
              <div class="font-semibold text-[color:var(--color-primary)] truncate">
                {{ row.label }}
              </div>
              <div class="text-xs text-[color:var(--color-on-surface-variant)] truncate">
                {{ row.hint }}
              </div>
            </div>
            <span class="text-[10px] uppercase tracking-wide text-[color:var(--color-on-surface-variant)] shrink-0">
              Page
            </span>
          </button>
        </template>

        <template v-if="txRows.length">
          <div class="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Transactions
          </div>
          <button
            v-for="(row, i) in txRows"
            :key="row.id"
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors"
            :class="isActive(i, txRows) ? 'bg-[color:var(--color-surface-container-high)]' : 'hover:bg-[color:var(--color-surface-container-low)]'"
            @click="onRowClick(row)"
            @mouseenter="activeIndex = allRows.indexOf(row)"
          >
            <div class="min-w-0">
              <div class="font-semibold text-[color:var(--color-primary)] truncate">
                {{ row.label }}
              </div>
              <div class="text-xs text-[color:var(--color-on-surface-variant)] truncate font-mono">
                {{ row.hint }}
              </div>
            </div>
            <span class="text-[10px] uppercase tracking-wide text-[color:var(--color-on-surface-variant)] shrink-0">
              Deal
            </span>
          </button>
        </template>

        <template v-if="agentRows.length">
          <div class="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Agents
          </div>
          <button
            v-for="(row, i) in agentRows"
            :key="row.id"
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors"
            :class="isActive(i, agentRows) ? 'bg-[color:var(--color-surface-container-high)]' : 'hover:bg-[color:var(--color-surface-container-low)]'"
            @click="onRowClick(row)"
            @mouseenter="activeIndex = allRows.indexOf(row)"
          >
            <div class="min-w-0">
              <div class="font-semibold text-[color:var(--color-primary)] truncate">
                {{ row.label }}
              </div>
              <div class="text-xs text-[color:var(--color-on-surface-variant)] truncate">
                {{ row.hint }}
              </div>
            </div>
            <span class="text-[10px] uppercase tracking-wide text-[color:var(--color-on-surface-variant)] shrink-0">
              Agent
            </span>
          </button>
        </template>

        <div v-if="showEmpty" class="px-4 py-6 text-center">
          <div class="text-sm font-semibold text-[color:var(--color-primary)]">
            No results
          </div>
          <div class="text-xs text-[color:var(--color-on-surface-variant)] mt-1">
            Try a property title, reference code, or agent name.
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3 border-t border-[color:var(--color-surface-container)] px-4 py-2 text-[10px] text-[color:var(--color-on-surface-variant)]">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <kbd class="font-mono px-1.5 py-0.5 rounded bg-[color:var(--color-surface-container-high)]">↑</kbd>
            <kbd class="font-mono px-1.5 py-0.5 rounded bg-[color:var(--color-surface-container-high)]">↓</kbd>
            navigate
          </span>
          <span class="flex items-center gap-1">
            <kbd class="font-mono px-1.5 py-0.5 rounded bg-[color:var(--color-surface-container-high)]">Enter</kbd>
            open
          </span>
        </div>
        <span class="font-mono">Cmd/Ctrl + K</span>
      </div>
    </div>
  </div>
</template>
