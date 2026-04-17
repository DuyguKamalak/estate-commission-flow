<script setup lang="ts">
const navItems = [
  { label: 'Dashboard', to: '/', icon: 'home' },
  { label: 'Transactions', to: '/transactions', icon: 'briefcase' },
  { label: 'Agents', to: '/agents', icon: 'users' },
  { label: 'Reports', to: '/reports', icon: 'chart' },
  { label: 'Settings', to: '/settings', icon: 'cog' },
] as const;
</script>

<template>
  <div class="min-h-screen flex bg-[color:var(--color-background)] text-[color:var(--color-on-background)]">
    <!-- Sidebar — mid-tier surface, no border, tonal separation only -->
    <aside
      class="hidden md:flex flex-col w-64 shrink-0 bg-[color:var(--color-surface-container)] px-6 py-8 gap-10"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-[var(--radius-sharp)] flex items-center justify-center text-[color:var(--color-on-primary)] font-bold"
          style="background-image: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-container) 100%)"
        >
          EC
        </div>
        <div>
          <div class="font-display font-bold text-[color:var(--color-primary)] leading-tight">
            Estate Commission
          </div>
          <div class="text-xs text-[color:var(--color-on-surface-variant)] tracking-wide uppercase">
            Flow Manager
          </div>
        </div>
      </div>

      <nav class="flex flex-col gap-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-medium text-[color:var(--color-on-surface-variant)] hover:bg-[color:var(--color-surface-container-high)] hover:text-[color:var(--color-primary)] transition-colors"
          active-class="!bg-[color:var(--color-surface-container-lowest)] !text-[color:var(--color-primary)] shadow-[var(--shadow-ambient-sm)]"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="mt-auto text-xs text-[color:var(--color-on-surface-variant)] leading-relaxed">
        <div class="font-semibold text-[color:var(--color-primary)] mb-1">Iceberg Digital UK</div>
        v0.1.0 · Sprint 2
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="flex items-center justify-between px-6 md:px-10 py-5 bg-[color:var(--color-surface-container-low)]"
      >
        <div>
          <div class="text-xs uppercase tracking-[0.08em] text-[color:var(--color-on-surface-variant)]">
            Operations console
          </div>
          <h1 class="font-display text-xl font-bold text-[color:var(--color-primary)] mt-0.5">
            Estate Commission Flow
          </h1>
        </div>
        <div class="hidden sm:flex items-center gap-3">
          <button class="btn-tertiary text-sm">Help</button>
          <button class="btn-primary text-sm">New transaction</button>
        </div>
      </header>

      <main class="flex-1 px-6 md:px-10 py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
