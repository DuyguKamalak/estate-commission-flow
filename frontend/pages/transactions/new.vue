<script setup lang="ts">
import { TransactionType } from '~/types/api';

useHead({ title: 'New transaction · Estate Commission Flow' });

const transactions = useTransactionsStore();
const agents = useAgentsStore();
const toast = useToast();
const { formatMinor } = useCurrency();

/*
 * Single-screen form with four logical sections: property, deal,
 * agents, notes. A live commission preview sits alongside so the
 * operator sees the split updating as they type the fee and pick
 * agents. Submission validates locally, then delegates to the
 * backend's authoritative rules — if the backend disagrees (e.g.
 * agent became inactive), we surface the machine-readable error.
 */
await useAsyncData('agents-for-tx-create', () =>
  agents.list ? Promise.resolve(true) : agents.fetchList({ pageSize: 200 }).then(() => true),
);

const activeAgents = computed(() =>
  agents.items.filter((a) => a.isActive),
);

const form = reactive({
  propertyTitle: '',
  propertyAddress: '',
  transactionType: TransactionType.SALE as 'sale' | 'rent',
  feeMajor: '' as string,
  currency: 'GBP',
  listingAgentId: '',
  sellingAgentId: '',
  agreementDate: '',
  notes: '',
});

const errors = reactive<Record<string, string | null>>({
  propertyTitle: null,
  propertyAddress: null,
  feeMajor: null,
  listingAgentId: null,
  sellingAgentId: null,
});

/**
 * Parse the human-typed fee (major units, e.g. "1000.01") into the
 * integer pence we send to the API. Returns null when the input
 * isn't a sensible positive number with at most two decimals.
 */
const feeMinorUnits = computed<number | null>(() => {
  const raw = form.feeMajor.trim();
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
});

const preview = computed(() =>
  feeMinorUnits.value && form.listingAgentId && form.sellingAgentId
    ? computeCommissionPreview({
        totalServiceFee: feeMinorUnits.value,
        listingAgentId: form.listingAgentId,
        sellingAgentId: form.sellingAgentId,
      })
    : null,
);

function validate(): boolean {
  errors.propertyTitle = form.propertyTitle.trim().length < 2
    ? 'Property title is required (at least 2 characters).'
    : null;
  errors.propertyAddress = form.propertyAddress.trim().length < 5
    ? 'Property address is required (at least 5 characters).'
    : null;
  errors.feeMajor = feeMinorUnits.value === null
    ? 'Enter the service fee as a positive number with up to two decimals.'
    : null;
  errors.listingAgentId = form.listingAgentId ? null : 'Listing agent is required.';
  errors.sellingAgentId = form.sellingAgentId ? null : 'Selling agent is required.';

  return Object.values(errors).every((e) => !e);
}

const submitting = ref(false);

async function onSubmit() {
  if (!validate()) {
    toast.error(
      'Please review the form',
      'Some fields need attention before we can save this transaction.',
    );
    return;
  }

  submitting.value = true;
  try {
    const tx = await transactions.create({
      propertyTitle: form.propertyTitle.trim(),
      propertyAddress: form.propertyAddress.trim(),
      transactionType: form.transactionType,
      totalServiceFee: feeMinorUnits.value!,
      currency: form.currency.trim().toUpperCase() || 'GBP',
      listingAgentId: form.listingAgentId,
      sellingAgentId: form.sellingAgentId,
      agreementDate: form.agreementDate || undefined,
      notes: form.notes.trim() || undefined,
    });
    toast.success(
      'Transaction created',
      `Reference ${tx.referenceCode} — now in Agreement.`,
    );
    await navigateTo(`/transactions/${tx.id}`);
  } catch (err) {
    const message = (err as Error).message || 'Unexpected error';
    toast.error('Could not create transaction', message);
  } finally {
    submitting.value = false;
  }
}

function agentLabel(id: string): string {
  const a = agents.items.find((x) => x.id === id);
  if (!a) return 'Unknown';
  return a.fullName ?? `${a.firstName} ${a.lastName}`;
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="New transaction"
      title="Book a new deal"
      description="Enter the property and agents — the system generates a reference code and opens the transaction in the Agreement stage."
    >
      <template #actions>
        <NuxtLink to="/transactions" class="btn-tertiary text-sm">
          ← Ledger
        </NuxtLink>
      </template>
    </PageHeader>

    <form
      class="grid grid-cols-1 lg:grid-cols-3 gap-5"
      @submit.prevent="onSubmit"
    >
      <!-- Form column -->
      <div class="lg:col-span-2 flex flex-col gap-5">
        <section class="ledger-card">
          <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
            Property
          </h3>
          <div class="mt-5 grid grid-cols-1 gap-4">
            <FormField
              label="Property title"
              for="tx-title"
              required
              :error="errors.propertyTitle"
            >
              <input
                id="tx-title"
                v-model="form.propertyTitle"
                type="text"
                class="field-input"
                maxlength="200"
                placeholder="e.g. Primrose Hill penthouse"
              >
            </FormField>

            <FormField
              label="Property address"
              for="tx-address"
              required
              :error="errors.propertyAddress"
            >
              <input
                id="tx-address"
                v-model="form.propertyAddress"
                type="text"
                class="field-input"
                maxlength="500"
                placeholder="Street, city, postcode"
              >
            </FormField>
          </div>
        </section>

        <section class="ledger-card">
          <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
            Deal
          </h3>
          <div class="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Type" for="tx-type" required>
              <select
                id="tx-type"
                v-model="form.transactionType"
                class="field-input"
              >
                <option :value="TransactionType.SALE">Sale</option>
                <option :value="TransactionType.RENT">Rent</option>
              </select>
            </FormField>

            <FormField
              label="Service fee"
              for="tx-fee"
              required
              :error="errors.feeMajor"
              helper="Enter the amount in major units (e.g. 1000.00)."
            >
              <input
                id="tx-fee"
                v-model="form.feeMajor"
                type="text"
                inputmode="decimal"
                class="field-input font-mono tabular-nums"
                placeholder="0.00"
              >
            </FormField>

            <FormField
              label="Currency"
              for="tx-currency"
              helper="ISO 4217 three-letter code."
            >
              <input
                id="tx-currency"
                v-model="form.currency"
                type="text"
                minlength="3"
                maxlength="3"
                class="field-input uppercase font-mono"
              >
            </FormField>

            <FormField
              label="Agreement date"
              for="tx-agreement-date"
              helper="Defaults to today if left blank."
            >
              <input
                id="tx-agreement-date"
                v-model="form.agreementDate"
                type="date"
                class="field-input"
              >
            </FormField>
          </div>
        </section>

        <section class="ledger-card">
          <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
            Agents
          </h3>
          <p class="text-xs text-[color:var(--color-on-surface-variant)] mt-1">
            If the same agent handles both roles, pick them in both fields —
            the breakdown will credit the full agent pool to them.
          </p>
          <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Listing agent"
              for="tx-listing-agent"
              required
              :error="errors.listingAgentId"
            >
              <select
                id="tx-listing-agent"
                v-model="form.listingAgentId"
                class="field-input"
              >
                <option value="">Select an agent</option>
                <option
                  v-for="agent in activeAgents"
                  :key="`listing-${agent.id}`"
                  :value="agent.id"
                >
                  {{ agent.fullName ?? `${agent.firstName} ${agent.lastName}` }}
                </option>
              </select>
            </FormField>

            <FormField
              label="Selling agent"
              for="tx-selling-agent"
              required
              :error="errors.sellingAgentId"
            >
              <select
                id="tx-selling-agent"
                v-model="form.sellingAgentId"
                class="field-input"
              >
                <option value="">Select an agent</option>
                <option
                  v-for="agent in activeAgents"
                  :key="`selling-${agent.id}`"
                  :value="agent.id"
                >
                  {{ agent.fullName ?? `${agent.firstName} ${agent.lastName}` }}
                </option>
              </select>
            </FormField>
          </div>
        </section>

        <section class="ledger-card">
          <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
            Notes
          </h3>
          <FormField
            label="Internal notes"
            for="tx-notes"
            helper="Visible on the transaction detail page. Up to 2 000 characters."
            class="mt-5"
          >
            <textarea
              id="tx-notes"
              v-model="form.notes"
              rows="4"
              maxlength="2000"
              class="field-input font-sans"
              placeholder="Any caveats, expected completion date, or context for the team"
            />
          </FormField>
        </section>

        <div class="flex items-center justify-end gap-2">
          <NuxtLink to="/transactions" class="btn-tertiary text-sm">
            Cancel
          </NuxtLink>
          <button
            type="submit"
            class="btn-primary text-sm"
            :disabled="submitting"
          >
            {{ submitting ? 'Saving…' : 'Create transaction' }}
          </button>
        </div>
      </div>

      <!-- Preview column -->
      <aside class="lg:sticky lg:top-8 self-start flex flex-col gap-4">
        <div class="ledger-card">
          <h3 class="font-display text-base font-bold text-[color:var(--color-primary)]">
            Commission preview
          </h3>
          <p class="text-xs text-[color:var(--color-on-surface-variant)] mt-1">
            Calculated locally to match the authoritative backend rule.
            The final snapshot is persisted when the deal completes.
          </p>

          <div v-if="!preview" class="mt-5 text-sm text-[color:var(--color-on-surface-variant)]">
            Fill in the fee and both agents to see how the pool will split.
          </div>
          <div v-else class="mt-5 space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-[color:var(--color-on-surface-variant)]">Total fee</span>
              <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                {{ formatMinor(preview.totalServiceFee, form.currency || 'GBP') }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[color:var(--color-on-surface-variant)]">Agency (50%)</span>
              <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                {{ formatMinor(preview.agencyShare, form.currency || 'GBP') }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[color:var(--color-on-surface-variant)]">Agent pool</span>
              <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                {{ formatMinor(preview.agentPool, form.currency || 'GBP') }}
              </span>
            </div>

            <div class="pt-3 mt-3 space-y-2 border-t border-[color:var(--color-surface-container)]">
              <div v-if="preview.isSameAgent">
                <div class="text-xs text-[color:var(--color-on-surface-variant)]">
                  Same agent
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-[color:var(--color-primary)]">
                    {{ agentLabel(form.listingAgentId) }}
                  </span>
                  <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                    {{ formatMinor(preview.listingAgentShare, form.currency || 'GBP') }}
                  </span>
                </div>
              </div>
              <template v-else>
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-[color:var(--color-primary)]">
                      {{ agentLabel(form.listingAgentId) }}
                    </div>
                    <div class="text-xs text-[color:var(--color-on-surface-variant)]">
                      Listing
                    </div>
                  </div>
                  <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                    {{ formatMinor(preview.listingAgentShare, form.currency || 'GBP') }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-[color:var(--color-primary)]">
                      {{ agentLabel(form.sellingAgentId) }}
                    </div>
                    <div class="text-xs text-[color:var(--color-on-surface-variant)]">
                      Selling
                    </div>
                  </div>
                  <span class="font-mono font-semibold text-[color:var(--color-primary)]">
                    {{ formatMinor(preview.sellingAgentShare, form.currency || 'GBP') }}
                  </span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="ledger-card ledger-card--tight text-xs text-[color:var(--color-on-surface-variant)]">
          The transaction will be created at <strong class="text-[color:var(--color-primary)]">Agreement</strong>
          and progress one stage at a time:
          Agreement → Earnest money → Title deed → Completed.
        </div>
      </aside>
    </form>
  </div>
</template>
