<template>
  <section class="card stack">
    <h2>FundNest Platform</h2>
    <p>
      Multi-tenant donation platform demo. Use the links below to open a public tenant page or
      the tenant admin dashboard.
    </p>

    <div class="actions">
      <RouterLink class="btn" to="/c/demo-charity">
        Open Demo Charity Page
      </RouterLink>
      <RouterLink class="btn secondary" to="/admin">
        Open Tenant Admin
      </RouterLink>
    </div>

    <p class="muted">API base URL: <code>{{ apiBaseUrl }}</code></p>
  </section>
</template>

<script setup>
import { API_BASE_URL as apiBaseUrl } from "../lib/api";
</script>
