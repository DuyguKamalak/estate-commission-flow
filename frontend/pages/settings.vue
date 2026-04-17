<script setup lang="ts">
useHead({ title: 'Settings · Estate Commission Flow' });

const { public: publicConfig } = useRuntimeConfig();

/*
 * `process.env.NODE_ENV` is replaced by Vite at build time, so reading
 * it directly in the template confuses the SSR transform. We capture
 * it here in the script block where static replacement is safe.
 */
const environmentName = process.env.NODE_ENV ?? 'development';
</script>

<template>
  <div class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Workspace"
      title="Settings"
      description="Environment and build information for the operations console."
    />

    <section class="ledger-card">
      <dl class="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8 text-sm">
        <div>
          <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            API base URL
          </dt>
          <dd class="mt-1 font-mono text-[color:var(--color-primary)] break-all">
            {{ publicConfig.apiBaseUrl }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Environment
          </dt>
          <dd class="mt-1 font-mono text-[color:var(--color-primary)]">
            {{ environmentName }}
          </dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Version
          </dt>
          <dd class="mt-1 font-mono text-[color:var(--color-primary)]">0.1.0</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-[color:var(--color-on-surface-variant)]">
            Built by
          </dt>
          <dd class="mt-1 text-[color:var(--color-primary)]">
            <a
              href="https://github.com/DuyguKamalak"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold hover:underline"
            >
              Duygu Kamalak
            </a>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
