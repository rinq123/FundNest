<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiRequest } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/session";

const session = ref(loadSession());
const authError = ref("");
const loading = ref(false);

// Tenant-admin state
const me = ref(null);
const donations = ref([]);
const dashboardError = ref("");
const saveConfigState = ref("idle");
const saveConfigError = ref("");

// Platform-admin state
const platformListState = ref("idle");
const platformError = ref("");
const platformTenants = ref([]);
const tenantActionState = reactive({});
const tenantActionError = reactive({});

const loginForm = reactive({
  loginMode: "tenant",
  tenantSlug: session.value?.tenantSlug ?? "demo-charity",
  email: session.value?.email ?? "admin@democharity.local",
  password: ""
});

const tenantConfigForm = reactive({
  brandColor: "#0f5ca8",
  logoUrl: "",
  currency: "GBP",
  donationPresetsText: "500,1000,2000,5000"
});

const platformCreateForm = reactive({
  name: "New Charity",
  slug: "new-charity"
});

const createPlatformState = ref("idle");
const createPlatformError = ref("");

const token = computed(() => session.value?.accessToken ?? "");
const role = computed(() => session.value?.role ?? "");
const isTenantAdmin = computed(() => role.value === "tenant_admin");
const isPlatformAdmin = computed(() => role.value === "platform_admin");

function formatMinor(amount, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency
  }).format((Number(amount) || 0) / 100);
}

function parsePresets(input) {
  const values = String(input)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  return values.length ? values : null;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setLoginMode(mode) {
  loginForm.loginMode = mode;
  authError.value = "";

  if (mode === "platform") {
    loginForm.tenantSlug = "";
    loginForm.email = "platform@fundnest.local";
  } else if (!loginForm.tenantSlug) {
    loginForm.tenantSlug = "demo-charity";
    loginForm.email = "admin@democharity.local";
  }
}

async function loadTenantDashboard() {
  if (!token.value || !isTenantAdmin.value) {
    return;
  }

  loading.value = true;
  dashboardError.value = "";

  try {
    const meResponse = await apiRequest("/api/admin/me", { token: token.value });
    me.value = meResponse;

    const donationsResponse = await apiRequest("/api/admin/donations", { token: token.value });
    donations.value = donationsResponse.donations ?? [];

    const tenantResponse = await apiRequest(`/api/public/tenants/${meResponse.tenantSlug}`);
    tenantConfigForm.brandColor = tenantResponse.config.brandColor ?? "#0f5ca8";
    tenantConfigForm.logoUrl = tenantResponse.config.logoUrl ?? "";
    tenantConfigForm.currency = tenantResponse.config.currency ?? "GBP";
    tenantConfigForm.donationPresetsText = (tenantResponse.config.donationPresets ?? []).join(",");
  } catch (err) {
    dashboardError.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function saveTenantConfig() {
  saveConfigState.value = "saving";
  saveConfigError.value = "";

  try {
    const presets = parsePresets(tenantConfigForm.donationPresetsText);

    await apiRequest("/api/admin/config", {
      method: "PATCH",
      token: token.value,
      body: {
        brandColor: tenantConfigForm.brandColor,
        logoUrl: tenantConfigForm.logoUrl || null,
        currency: tenantConfigForm.currency,
        donationPresets: presets
      }
    });

    saveConfigState.value = "saved";
    await loadTenantDashboard();
  } catch (err) {
    saveConfigState.value = "error";
    saveConfigError.value = err.message;
  }
}

async function loadPlatformTenants() {
  if (!token.value || !isPlatformAdmin.value) {
    return;
  }

  platformListState.value = "loading";
  platformError.value = "";

  try {
    const response = await apiRequest("/api/platform/tenants", { token: token.value });
    platformTenants.value = response.tenants ?? [];
    platformListState.value = "success";
  } catch (err) {
    platformListState.value = "error";
    platformError.value = err.message;
  }
}

async function createPlatformTenant() {
  createPlatformState.value = "saving";
  createPlatformError.value = "";

  try {
    await apiRequest("/api/platform/tenants", {
      method: "POST",
      token: token.value,
      body: {
        name: platformCreateForm.name,
        slug: slugify(platformCreateForm.slug)
      }
    });
    createPlatformState.value = "saved";
    await loadPlatformTenants();
  } catch (err) {
    createPlatformState.value = "error";
    createPlatformError.value = err.message;
  }
}

async function toggleArchive(tenant) {
  const key = tenant.tenantId;
  tenantActionState[key] = "busy";
  tenantActionError[key] = "";

  try {
    await apiRequest(`/api/platform/tenants/${tenant.tenantId}/archive`, {
      method: "PATCH",
      token: token.value,
      body: {
        archived: !tenant.isArchived
      }
    });
    await loadPlatformTenants();
  } catch (err) {
    tenantActionError[key] = err.message;
  } finally {
    tenantActionState[key] = "idle";
  }
}

async function deleteTenant(tenant) {
  const confirmed = window.confirm(
    `Delete tenant "${tenant.name}" (${tenant.slug})? This removes tenant users and donations.`
  );
  if (!confirmed) {
    return;
  }

  const key = tenant.tenantId;
  tenantActionState[key] = "busy";
  tenantActionError[key] = "";

  try {
    await apiRequest(`/api/platform/tenants/${tenant.tenantId}`, {
      method: "DELETE",
      token: token.value
    });
    await loadPlatformTenants();
  } catch (err) {
    tenantActionError[key] = err.message;
  } finally {
    tenantActionState[key] = "idle";
  }
}

async function login() {
  authError.value = "";
  loading.value = true;

  try {
    const payload = {
      loginMode: loginForm.loginMode,
      email: loginForm.email,
      password: loginForm.password
    };

    if (loginForm.loginMode === "tenant") {
      payload.tenantSlug = loginForm.tenantSlug;
    }

    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: payload
    });

    session.value = {
      accessToken: response.accessToken,
      role: response.user.role,
      tenantSlug: response.user.tenantSlug,
      email: response.user.email
    };
    saveSession(session.value);

    loginForm.password = "";

    if (response.user.role === "platform_admin") {
      me.value = null;
      donations.value = [];
      await loadPlatformTenants();
    } else {
      platformTenants.value = [];
      await loadTenantDashboard();
    }
  } catch (err) {
    authError.value = err.message;
  } finally {
    loading.value = false;
  }
}

function logout() {
  clearSession();
  session.value = null;
  me.value = null;
  donations.value = [];
  dashboardError.value = "";
  saveConfigState.value = "idle";
  saveConfigError.value = "";
  platformTenants.value = [];
  platformError.value = "";
  platformListState.value = "idle";
  createPlatformState.value = "idle";
  createPlatformError.value = "";
  loginForm.password = "";
  setLoginMode("tenant");
}

onMounted(async () => {
  if (!session.value) {
    return;
  }

  if (session.value.role === "platform_admin") {
    await loadPlatformTenants();
  } else if (session.value.role === "tenant_admin") {
    await loadTenantDashboard();
  } else {
    logout();
  }
});
</script>

<template>
  <section class="stack">
    <section class="card stack">
      <h2>Admin Console</h2>

      <template v-if="!session">
        <form class="stack" @submit.prevent="login">
          <label class="stack-sm">
            <span>Login Mode</span>
            <select v-model="loginForm.loginMode" @change="setLoginMode(loginForm.loginMode)">
              <option value="tenant">Tenant Admin</option>
              <option value="platform">Platform Admin</option>
            </select>
          </label>

          <label v-if="loginForm.loginMode === 'tenant'" class="stack-sm">
            <span>Tenant Slug</span>
            <input v-model.trim="loginForm.tenantSlug" required />
          </label>

          <label class="stack-sm">
            <span>Email</span>
            <input v-model.trim="loginForm.email" type="email" required />
          </label>

          <label class="stack-sm">
            <span>Password</span>
            <input v-model="loginForm.password" type="password" required />
          </label>

          <button class="btn" type="submit" :disabled="loading">
            {{ loading ? "Logging in..." : "Login" }}
          </button>
        </form>

        <p v-if="authError" class="error">{{ authError }}</p>
      </template>

      <template v-else>
        <div class="actions between">
          <p class="muted">
            Authenticated as <strong>{{ session.email }}</strong>
            ({{ role }})
          </p>
          <button class="btn secondary" @click="logout">Logout</button>
        </div>
      </template>
    </section>

    <section v-if="session && isTenantAdmin && me" class="card stack">
      <h3>Tenant Overview</h3>
      <p><strong>Tenant:</strong> {{ me.tenantSlug }}</p>
      <p><strong>Donation Count:</strong> {{ donations.length }}</p>
      <p v-if="dashboardError" class="error">{{ dashboardError }}</p>
    </section>

    <section v-if="session && isTenantAdmin && me" class="card stack">
      <h3>Branding Configuration</h3>

      <form class="stack" @submit.prevent="saveTenantConfig">
        <label class="stack-sm">
          <span>Brand Color</span>
          <input v-model.trim="tenantConfigForm.brandColor" required />
        </label>

        <label class="stack-sm">
          <span>Logo URL (optional)</span>
          <input v-model.trim="tenantConfigForm.logoUrl" />
        </label>

        <label class="stack-sm">
          <span>Currency (3-letter code)</span>
          <input v-model.trim="tenantConfigForm.currency" maxlength="3" required />
        </label>

        <label class="stack-sm">
          <span>Donation Presets (minor units, comma-separated)</span>
          <input v-model="tenantConfigForm.donationPresetsText" placeholder="500,1000,2500" />
        </label>

        <button class="btn" type="submit">Save Config</button>
      </form>

      <p v-if="saveConfigState === 'saved'" class="success">Config updated.</p>
      <p v-if="saveConfigError" class="error">{{ saveConfigError }}</p>
    </section>

    <section v-if="session && isTenantAdmin && me" class="card stack">
      <h3>Recent Donations</h3>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Donor</th>
              <th>PaymentIntent</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="donation in donations" :key="donation.donationId">
              <td>{{ new Date(donation.createdAt).toLocaleString() }}</td>
              <td>{{ formatMinor(donation.amountMinor, donation.currency) }}</td>
              <td>{{ donation.status }}</td>
              <td>{{ donation.donorEmail || "-" }}</td>
              <td><code>{{ donation.stripePaymentIntentId }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="session && isPlatformAdmin" class="card stack">
      <h3>Platform: Create Tenant</h3>
      <form class="stack" @submit.prevent="createPlatformTenant">
        <div class="grid-2">
          <label class="stack-sm">
            <span>Name</span>
            <input v-model.trim="platformCreateForm.name" required />
          </label>
          <label class="stack-sm">
            <span>Slug</span>
            <input v-model.trim="platformCreateForm.slug" required />
          </label>
        </div>
        <button class="btn" type="submit" :disabled="createPlatformState === 'saving'">
          {{ createPlatformState === "saving" ? "Creating..." : "Create Tenant" }}
        </button>
      </form>
      <p v-if="createPlatformState === 'saved'" class="success">Tenant created.</p>
      <p v-if="createPlatformError" class="error">{{ createPlatformError }}</p>
    </section>

    <section v-if="session && isPlatformAdmin" class="card stack">
      <div class="actions between">
        <h3>Platform: All Tenants</h3>
        <button class="btn secondary" type="button" @click="loadPlatformTenants">
          {{ platformListState === "loading" ? "Refreshing..." : "Refresh" }}
        </button>
      </div>

      <p v-if="platformError" class="error">{{ platformError }}</p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Created</th>
              <th>Admins</th>
              <th>Donations</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tenant in platformTenants" :key="tenant.tenantId">
              <td>{{ tenant.name }}</td>
              <td><code>{{ tenant.slug }}</code></td>
              <td>
                <span :class="tenant.isArchived ? 'status-archived' : 'status-active'">
                  {{ tenant.isArchived ? "Archived" : "Active" }}
                </span>
              </td>
              <td>{{ new Date(tenant.createdAt).toLocaleString() }}</td>
              <td>{{ tenant.adminUserCount }}</td>
              <td>{{ tenant.donationCount }}</td>
              <td>
                <div class="actions">
                  <RouterLink
                    v-if="!tenant.isArchived"
                    class="btn secondary btn-sm"
                    :to="`/c/${tenant.slug}`"
                  >
                    Open
                  </RouterLink>
                  <button
                    class="btn secondary btn-sm"
                    type="button"
                    @click="toggleArchive(tenant)"
                    :disabled="tenantActionState[tenant.tenantId] === 'busy'"
                  >
                    {{ tenant.isArchived ? "Unarchive" : "Archive" }}
                  </button>
                  <button
                    class="btn danger btn-sm"
                    type="button"
                    @click="deleteTenant(tenant)"
                    :disabled="tenantActionState[tenant.tenantId] === 'busy'"
                  >
                    Delete
                  </button>
                </div>
                <p v-if="tenantActionError[tenant.tenantId]" class="error">
                  {{ tenantActionError[tenant.tenantId] }}
                </p>
              </td>
            </tr>
            <tr v-if="!platformTenants.length">
              <td colspan="7" class="muted">No tenants found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
