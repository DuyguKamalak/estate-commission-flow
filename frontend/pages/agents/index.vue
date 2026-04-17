<script setup lang="ts">
useHead({ title: 'Agents · Estate Commission Flow' });

const agents = useAgentsStore();
const toast = useToast();

/*
 * Agent directory with inline create flow via a modal. Deactivation
 * is a soft-delete on the backend (flips `isActive` false); we mirror
 * that by keeping the row visible but tagged so operators can still
 * see historical relationships.
 */
await useAsyncData('agents-list', () => agents.fetchList({ pageSize: 100 }));

const showInactive = ref(false);

const visibleAgents = computed(() => {
  const rows = agents.items;
  return showInactive.value ? rows : rows.filter((a) => a.isActive);
});

/* ---------------- Create modal state ---------------- */

const createOpen = ref(false);
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
});
const errors = reactive<Record<string, string | null>>({
  firstName: null,
  lastName: null,
  email: null,
});
const submitting = ref(false);

function resetForm() {
  form.firstName = '';
  form.lastName = '';
  form.email = '';
  form.phone = '';
  errors.firstName = null;
  errors.lastName = null;
  errors.email = null;
}

function openCreateModal() {
  resetForm();
  createOpen.value = true;
}

function validate(): boolean {
  errors.firstName = form.firstName.trim().length < 1
    ? 'First name is required.'
    : null;
  errors.lastName = form.lastName.trim().length < 1
    ? 'Last name is required.'
    : null;
  errors.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ? null
    : 'Enter a valid email address.';
  return Object.values(errors).every((e) => !e);
}

async function onSubmit() {
  if (!validate()) return;
  submitting.value = true;
  try {
    const agent = await agents.create({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
    });
    toast.success(
      'Agent added',
      `${agent.fullName ?? `${agent.firstName} ${agent.lastName}`} is now on the roster.`,
    );
    createOpen.value = false;
    await agents.fetchList({ pageSize: 100 });
  } catch (err) {
    const message = (err as Error).message || 'Unexpected error';
    toast.error('Could not add agent', message);
  } finally {
    submitting.value = false;
  }
}

/* ---------------- Deactivate ---------------- */

const deactivating = ref<string | null>(null);

async function deactivate(id: string, name: string) {
  if (!confirm(`Deactivate ${name}? They'll no longer appear in agent pickers.`)) return;
  deactivating.value = id;
  try {
    await agents.deactivate(id);
    toast.success('Agent deactivated', `${name} is hidden from new deals.`);
    await agents.fetchList({ pageSize: 100 });
  } catch (err) {
    toast.error('Could not deactivate', (err as Error).message);
  } finally {
    deactivating.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Directory"
      title="Agents"
      description="The people booking deals and earning commission. Active agents appear in the transaction create flow."
    >
      <template #actions>
        <label
          class="flex items-center gap-2 text-xs text-[color:var(--color-on-surface-variant)] cursor-pointer select-none"
        >
          <input v-model="showInactive" type="checkbox" class="accent-[color:var(--color-secondary)]">
          Show inactive
        </label>
        <button type="button" class="btn-primary text-sm" @click="openCreateModal">
          Add agent
        </button>
      </template>
    </PageHeader>

    <section class="ledger-card">
      <DataStateBoundary
        :loading="agents.listLoading && !agents.list"
        :error="agents.listError"
        :empty="!agents.listLoading && visibleAgents.length === 0"
        empty-title="No agents yet"
        empty-description="Add the first agent to start booking transactions."
        @retry="agents.fetchList({ pageSize: 100 })"
      >
        <template #emptyAction>
          <button type="button" class="btn-primary text-sm" @click="openCreateModal">
            Add your first agent
          </button>
        </template>

        <div class="divide-y divide-[color:var(--color-surface-container)]">
          <div
            v-for="agent in visibleAgents"
            :key="agent.id"
            class="flex items-center justify-between py-4 gap-4"
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
                class="text-xs text-[color:var(--color-on-surface-variant)] font-mono hidden sm:inline"
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
              <button
                v-if="agent.isActive"
                type="button"
                class="btn-tertiary text-xs"
                :disabled="deactivating === agent.id"
                @click="deactivate(agent.id, agent.fullName ?? `${agent.firstName} ${agent.lastName}`)"
              >
                {{ deactivating === agent.id ? 'Deactivating…' : 'Deactivate' }}
              </button>
            </div>
          </div>
        </div>
      </DataStateBoundary>
    </section>

    <!-- Create modal -->
    <ModalShell
      :open="createOpen"
      title="Add a new agent"
      description="The email must be unique across the agency. Phone is optional."
      @close="createOpen = false"
    >
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="First name"
            for="agent-first-name"
            required
            :error="errors.firstName"
          >
            <input
              id="agent-first-name"
              v-model="form.firstName"
              type="text"
              class="field-input"
              maxlength="80"
            >
          </FormField>

          <FormField
            label="Last name"
            for="agent-last-name"
            required
            :error="errors.lastName"
          >
            <input
              id="agent-last-name"
              v-model="form.lastName"
              type="text"
              class="field-input"
              maxlength="80"
            >
          </FormField>
        </div>

        <FormField
          label="Email"
          for="agent-email"
          required
          :error="errors.email"
        >
          <input
            id="agent-email"
            v-model="form.email"
            type="email"
            class="field-input"
            maxlength="200"
            autocomplete="email"
          >
        </FormField>

        <FormField
          label="Phone"
          for="agent-phone"
          helper="Optional. Include the country code for international numbers."
        >
          <input
            id="agent-phone"
            v-model="form.phone"
            type="tel"
            class="field-input font-mono"
            maxlength="40"
          >
        </FormField>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="btn-tertiary text-sm"
            :disabled="submitting"
            @click="createOpen = false"
          >
            Cancel
          </button>
          <button type="submit" class="btn-primary text-sm" :disabled="submitting">
            {{ submitting ? 'Saving…' : 'Add agent' }}
          </button>
        </div>
      </form>
    </ModalShell>
  </div>
</template>
