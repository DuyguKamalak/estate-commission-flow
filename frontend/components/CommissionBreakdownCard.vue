<script setup lang="ts">
import {
  CommissionPartyRole,
  type Agent,
  type CommissionBreakdown,
} from '~/types/api';

/**
 * Renders the commission breakdown for a completed transaction.
 *
 * Layout mirrors the "Architectural Ledger" style: large, calm
 * numbers at the top (total → agency → agent pool), then one row
 * per party with agent name, role reason, and share. Same-agent
 * scenarios collapse into a single "listing + selling" row, which
 * matches the backend's `isSameAgent` flag.
 */
const props = defineProps<{
  breakdown: CommissionBreakdown;
  /** Lookup so we can print the agent's human-readable name. */
  agentsById: Record<string, Agent>;
}>();

function agentName(id: string): string {
  const a = props.agentsById[id];
  if (!a) return 'Unknown agent';
  return a.fullName ?? `${a.firstName} ${a.lastName}`;
}

const roleLabel: Record<string, string> = {
  [CommissionPartyRole.LISTING]: 'Listing agent',
  [CommissionPartyRole.SELLING]: 'Selling agent',
  [CommissionPartyRole.LISTING_AND_SELLING]: 'Listing + selling',
};
</script>

<template>
  <div class="ledger-card">
    <div class="flex items-center justify-between">
      <h3 class="font-display text-lg font-bold text-[color:var(--color-primary)]">
        Commission breakdown
      </h3>
      <span class="text-xs text-[color:var(--color-on-surface-variant)] font-mono">
        rule {{ breakdown.ruleVersion }}
      </span>
    </div>

    <div class="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="p-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface-container-low)]">
        <div class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
          Total service fee
        </div>
        <div class="mt-2 text-2xl font-display font-bold text-[color:var(--color-primary)] tabular-nums">
          <MoneyCell
            :value="breakdown.totalServiceFee"
            :currency="breakdown.currency"
          />
        </div>
      </div>

      <div class="p-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface-container-low)]">
        <div class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
          Agency share (50%)
        </div>
        <div class="mt-2 text-2xl font-display font-bold text-[color:var(--color-primary)] tabular-nums">
          <MoneyCell
            :value="breakdown.agencyShare"
            :currency="breakdown.currency"
          />
        </div>
      </div>

      <div class="p-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface-container-low)]">
        <div class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
          Agent pool (50%)
        </div>
        <div class="mt-2 text-2xl font-display font-bold text-[color:var(--color-primary)] tabular-nums">
          <MoneyCell
            :value="breakdown.agentPool"
            :currency="breakdown.currency"
          />
        </div>
      </div>
    </div>

    <div class="mt-6">
      <div class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)] mb-3">
        Agent distribution
      </div>
      <div class="divide-y divide-[color:var(--color-surface-container)]">
        <div
          v-for="party in breakdown.parties"
          :key="`${party.agentId}-${party.role}`"
          class="flex items-center justify-between py-3"
        >
          <div class="min-w-0">
            <div class="text-sm font-semibold text-[color:var(--color-primary)]">
              {{ agentName(party.agentId) }}
            </div>
            <div class="text-xs text-[color:var(--color-on-surface-variant)] mt-0.5">
              {{ roleLabel[party.role] ?? party.role }} · {{ party.reason }}
            </div>
          </div>
          <MoneyCell
            :value="party.share"
            :currency="breakdown.currency"
            tabular
          />
        </div>
      </div>
    </div>

    <div
      class="mt-5 p-3 rounded-[var(--radius-md)] bg-[color:var(--color-surface-container-low)] text-xs text-[color:var(--color-on-surface-variant)]"
    >
      {{ breakdown.isSameAgent
        ? 'Same agent handled both listing and selling — the full agent pool is credited to them.'
        : 'Listing and selling were handled by different agents; the pool was split evenly, with any odd penny routed to the listing agent.'
      }}
    </div>
  </div>
</template>
