<template>
  <section class="stack">
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

    <section class="card stack">
      <h3>Platform Admin: Create Tenant</h3>
      <p class="muted">
        This calls <code>POST /api/platform/tenants</code>. Use a unique slug each time.
      </p>

      <form class="stack" @submit.prevent="createTenant">
        <div class="grid-2">
          <label class="stack-sm">
            <span>Tenant Name</span>
            <input v-model.trim="form.name" required />
          </label>

          <label class="stack-sm">
            <span>Tenant Slug</span>
            <input v-model.trim="form.slug" required />
          </label>
        </div>

        <label class="stack-sm">
          <span>Platform Admin Secret</span>
          <input v-model.trim="form.platformSecret" type="password" required />
        </label>

        <div class="actions">
          <button class="btn" type="submit" :disabled="createState === 'submitting'">
            {{ createState === "submitting" ? "Creating..." : "Create Tenant" }}
          </button>
          <button class="btn secondary" type="button" @click="autoSlug">
            Auto-generate Slug
          </button>
        </div>
      </form>

      <p v-if="createError" class="error">{{ createError }}</p>

      <div v-if="createdTenant" class="panel stack-sm">
        <p class="success">Tenant created successfully.</p>
        <p><strong>Tenant ID:</strong> <code>{{ createdTenant.tenantId }}</code></p>
        <p><strong>Slug:</strong> <code>{{ createdTenant.slug }}</code></p>
        <div class="actions">
          <RouterLink class="btn secondary" :to="`/c/${createdTenant.slug}`">
            Open Tenant Page
          </RouterLink>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { reactive, ref } from "vue";
import { apiRequest, API_BASE_URL as apiBaseUrl } from "../lib/api";

const form = reactive({
  name: "New Charity",
  slug: "new-charity",
  platformSecret: import.meta.env.VITE_PLATFORM_ADMIN_SECRET ?? ""
});

const createState = ref("idle");
const createError = ref("");
const createdTenant = ref(null);

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function autoSlug() {
  form.slug = slugify(form.name || "new-charity");
}

async function createTenant() {
  createState.value = "submitting";
  createError.value = "";
  createdTenant.value = null;

  try {
    createdTenant.value = await apiRequest("/api/platform/tenants", {
      method: "POST",
      headers: {
        "x-platform-secret": form.platformSecret
      },
      body: {
        name: form.name,
        slug: slugify(form.slug)
      }
    });
    createState.value = "success";
  } catch (err) {
    createState.value = "error";
    createError.value = err.message;
  }
}
</script>
