<script setup lang="ts">
useHead({ title: 'Dashboard · Estate Commission Flow' });

/*
 * Placeholder dashboard screen — scaffolded in Sprint 2 so that `npm run dev`
 * lands on a real, styled page that already speaks the "Architectural Ledger"
 * design language. Real KPIs and data wiring land in Sprint 7.
 */
const kpis = [
  { label: 'Active transactions', value: '—', meta: 'Awaiting data' },
  { label: 'Completed this month', value: '—', meta: 'Awaiting data' },
  { label: 'Agency earnings (MTD)', value: '£—', meta: 'Awaiting data' },
  { label: 'Pending title deeds', value: '—', meta: 'Awaiting data' },
];
</script>

<template>
  <div class="flex flex-col gap-8">
    <section class="flex items-end justify-between">
      <div>
        <div class="text-xs uppercase tracking-[0.08em] text-[color:var(--color-on-surface-variant)]">
          Overview
        </div>
        <h2 class="font-display text-3xl font-bold text-[color:var(--color-primary)] mt-1">
          Welcome back
        </h2>
        <p class="text-sm text-[color:var(--color-on-surface-variant)] mt-1 max-w-xl">
          A calm, editorial view of every transaction in flight. This scaffold will be
          wired to live data in Sprint 7.
        </p>
      </div>
      <span class="badge badge--completed">Scaffold ready</span>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      <div v-for="kpi in kpis" :key="kpi.label" class="ledger-card">
        <div class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
          {{ kpi.label }}
        </div>
        <div class="font-display text-3xl font-bold text-[color:var(--color-primary)] mt-4">
          {{ kpi.value }}
        </div>
        <div class="text-xs text-[color:var(--color-on-surface-variant)] mt-2">{{ kpi.meta }}</div>
      </div>
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="ledger-card lg:col-span-2">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
            Recent transactions
          </h3>
          <NuxtLink to="/transactions" class="btn-tertiary text-sm">View all</NuxtLink>
        </div>
        <div class="mt-6 text-sm text-[color:var(--color-on-surface-variant)]">
          Transaction data will appear here once the API is connected (Sprint 7).
        </div>
      </div>

      <div class="ledger-card">
        <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
          Stage distribution
        </h3>
        <div class="mt-6 space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="badge badge--agreement">Agreement</span>
            <span class="text-[color:var(--color-on-surface-variant)]">—</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="badge badge--earnest">Earnest money</span>
            <span class="text-[color:var(--color-on-surface-variant)]">—</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="badge badge--titledeed">Title deed</span>
            <span class="text-[color:var(--color-on-surface-variant)]">—</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="badge badge--completed">Completed</span>
            <span class="text-[color:var(--color-on-surface-variant)]">—</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
