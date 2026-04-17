<script setup lang="ts">
useHead({ title: 'New transaction · Estate Commission Flow' });

/*
 * Placeholder landing page for the create-transaction flow. The full
 * multi-step form (property → agents → fee → review) lands in Sprint 6.
 * We keep the route wired up now so deep links and CTAs don't 404.
 */
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="New transaction"
      title="Book a new deal"
      description="The full create-transaction flow ships in Sprint 6. For now, you can explore the ledger and dashboard below."
    />

    <section class="ledger-card">
      <EmptyState
        title="Create flow coming in Sprint 6"
        description="You'll be able to enter property details, pick listing and selling agents, set the service fee, and confirm — with live validation and breakdown preview."
      >
        <NuxtLink to="/transactions" class="btn-primary text-sm">
          Back to ledger
        </NuxtLink>
      </EmptyState>
    </section>
  </div>
</template>
