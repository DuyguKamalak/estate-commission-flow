<script setup lang="ts">
useHead({ title: 'Reports · Estate Commission Flow' });

/*
 * Reports screen is intentionally thin for Sprint 5. The backend
 * already exposes commission aggregation endpoints; the full reporting
 * experience (completed-deals ledger, agent leaderboards, CSV export)
 * arrives in Sprint 7.
 */
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Analytics"
      title="Reports"
      description="Aggregated views of completed transactions and agent earnings."
    />

    <section class="ledger-card">
      <EmptyState
        title="Reporting surface in progress"
        description="Completed-deals ledger, agent leaderboards, and CSV export arrive in Sprint 7. For now, the dashboard shows the month-to-date summary."
      >
        <NuxtLink to="/" class="btn-primary text-sm">
          Open dashboard
        </NuxtLink>
      </EmptyState>
    </section>
  </div>
</template>
