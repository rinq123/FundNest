<script setup>
import { onMounted, ref } from "vue";
import { apiRequest } from "../lib/api";

const tenantListState = ref("loading");
const tenantListError = ref("");
const tenants = ref([]);

async function loadPublicTenants() {
  tenantListState.value = "loading";
  tenantListError.value = "";

  try {
    const response = await apiRequest("/api/public/tenants");
    tenants.value = response.tenants ?? [];
    tenantListState.value = "success";
  } catch (err) {
    tenantListState.value = "error";
    tenantListError.value = err.message;
  }
}

onMounted(loadPublicTenants);
</script>

<template>
  <section class="stack">
    <section class="card stack">
      <h2>FundNest Platform</h2>
      <p>
        Multi-tenant donation platform demo. Browse active public tenant pages or open the admin
        console.
      </p>

      <div class="actions">
        <RouterLink class="btn secondary" to="/admin">
          Open Admin Console
        </RouterLink>
      </div>
    </section>

    <section class="card stack">
      <div class="actions between">
        <h3>Public Tenant Pages</h3>
        <button class="btn secondary btn-sm" type="button" @click="loadPublicTenants">
          {{ tenantListState === "loading" ? "Refreshing..." : "Refresh" }}
        </button>
      </div>

      <p v-if="tenantListState === 'loading'">Loading tenant pages...</p>
      <p v-if="tenantListError" class="error">{{ tenantListError }}</p>

      <template v-if="tenantListState === 'success'">
        <div v-if="tenants.length" class="stack-sm">
          <div
            v-for="tenant in tenants"
            :key="tenant.tenantId"
            class="panel actions between"
          >
            <div class="stack-sm">
              <strong>{{ tenant.name }}</strong>
              <span class="muted"><code>{{ tenant.slug }}</code></span>
            </div>
            <RouterLink class="btn secondary btn-sm" :to="`/c/${tenant.slug}`">
              Open Page
            </RouterLink>
          </div>
        </div>

        <div v-else class="panel stack-sm">
          <p class="muted">No active tenant pages are available yet.</p>
          <p class="muted">Create one from the Platform Admin dashboard at <code>/admin</code>.</p>
        </div>
      </template>
    </section>

    <section class="card stack">
      <h3>Admin Login</h3>

      <p class="muted">Platform admin:</p>
      <p><code>email: platform@fundnest.local</code></p>
      <p><code>password: DemoPlatform123!</code></p>
    </section>
  </section>
</template>
