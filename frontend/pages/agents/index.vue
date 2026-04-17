<script setup lang="ts">
useHead({ title: 'Agents · Estate Commission Flow' });

const agents = useAgentsStore();

/*
 * Read-only agent directory for Sprint 5. Create/edit/deactivate flows
 * arrive in Sprint 6 alongside the transaction create form.
 */
await useAsyncData('agents-list', () => agents.fetchList({ pageSize: 200 }));

const showInactive = ref(false);

const visibleAgents = computed(() => {
  const rows = agents.items;
  return showInactive.value ? rows : rows.filter((a) => a.isActive);
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Directory"
      title="Agents"
      description="The people booking deals and earning commission. The full create/edit experience lands in Sprint 6."
    >
      <template #actions>
        <label
          class="flex items-center gap-2 text-xs text-[color:var(--color-on-surface-variant)] cursor-pointer select-none"
        >
          <input v-model="showInactive" type="checkbox" class="accent-[color:var(--color-secondary)]">
          Show inactive
        </label>
      </template>
    </PageHeader>

    <section class="ledger-card">
      <DataStateBoundary
        :loading="agents.listLoading && !agents.list"
        :error="agents.listError"
        :empty="!agents.listLoading && visibleAgents.length === 0"
        empty-title="No agents yet"
        empty-description="The roster is empty. Create the first agent in Sprint 6."
        @retry="agents.fetchList({ pageSize: 200 })"
      >
        <div class="divide-y divide-[color:var(--color-surface-container)]">
          <div
            v-for="agent in visibleAgents"
            :key="agent.id"
            class="flex items-center justify-between py-4"
          >
            <div class="flex items-center gap-4 min-w-0">
              <div
                class="w-10 h-10 rounded-full bg-[color:var(--color-surface-container-high)] text-[color:var(--color-primary)] font-semibold flex items-center justify-center shrink-0"
              >
                {{ (agent.firstName[0] ?? '') + (agent.lastName[0] ?? '') }}
              </div>
              <div class="min-w-0">
                <div class="font-semibold text-[color:var(--color-primary)] truncate">
                  {{ agent.fullName ?? `${agent.firstName} ${agent.lastName}` }}
                </div>
                <div class="text-xs text-[color:var(--color-on-surface-variant)] truncate">
                  {{ agent.email }}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span
                v-if="agent.phone"
                class="text-xs text-[color:var(--color-on-surface-variant)] font-mono"
              >
                {{ agent.phone }}
              </span>
              <span
                :class="[
                  'badge',
                  agent.isActive ? 'badge--completed' : 'badge--agreement',
                ]"
              >
                {{ agent.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
        </div>
      </DataStateBoundary>
    </section>
  </div>
</template>
