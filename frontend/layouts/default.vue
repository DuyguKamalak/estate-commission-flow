<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const navItems = [
  { label: 'Dashboard', to: '/', icon: 'home' },
  { label: 'Transactions', to: '/transactions', icon: 'briefcase' },
  { label: 'Agents', to: '/agents', icon: 'users' },
  { label: 'Reports', to: '/reports', icon: 'chart' },
  { label: 'Settings', to: '/settings', icon: 'cog' },
] as const;

const mobileNavOpen = ref(false);
const route = useRoute();

watch(
  () => route.fullPath,
  () => {
    mobileNavOpen.value = false;
  },
);
</script>

<template>
  <div class="min-h-screen flex bg-[color:var(--color-background)] text-[color:var(--color-on-background)]">
    <!-- Sidebar — desktop (md+) stays in flow; on mobile it slides in as a drawer -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 flex flex-col w-64 shrink-0 bg-[color:var(--color-surface-container)] px-6 py-8 gap-10 transition-transform duration-200 ease-out shadow-xl md:shadow-none',
        'md:static md:translate-x-0 md:flex',
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex items-center justify-between gap-3">
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
        <button
          type="button"
          class="md:hidden -mr-2 p-2 rounded-[var(--radius-md)] text-[color:var(--color-on-surface-variant)] hover:bg-[color:var(--color-surface-container-high)]"
          aria-label="Close navigation"
          @click="mobileNavOpen = false"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
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
        <div>v0.1.0</div>
        <div class="mt-2">
          Built by
          <a
            href="https://github.com/DuyguKamalak"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[color:var(--color-primary)] font-semibold hover:underline"
          >
            Duygu Kamalak
          </a>
        </div>
      </div>
    </aside>

    <!-- Backdrop: only rendered when the mobile drawer is open -->
    <button
      v-if="mobileNavOpen"
      type="button"
      class="fixed inset-0 z-30 bg-black/40 md:hidden"
      aria-label="Close navigation"
      @click="mobileNavOpen = false"
    />

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="flex items-center justify-between gap-3 px-4 sm:px-6 md:px-10 py-5 bg-[color:var(--color-surface-container-low)]"
      >
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            class="md:hidden p-2 -ml-2 rounded-[var(--radius-md)] text-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-container-high)]"
            aria-label="Open navigation"
            :aria-expanded="mobileNavOpen"
            @click="mobileNavOpen = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
          <div class="min-w-0">
            <div class="text-xs uppercase tracking-[0.08em] text-[color:var(--color-on-surface-variant)]">
              Operations console
            </div>
            <h1 class="font-display text-lg sm:text-xl font-bold text-[color:var(--color-primary)] mt-0.5 truncate">
              Estate Commission Flow
            </h1>
          </div>
        </div>
        <div class="hidden sm:flex items-center gap-3">
          <NuxtLink to="/reports" class="btn-tertiary text-sm">Reports</NuxtLink>
          <NuxtLink to="/transactions/new" class="btn-primary text-sm">
            New transaction
          </NuxtLink>
        </div>
      </header>

      <main class="flex-1 px-4 sm:px-6 md:px-10 py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
