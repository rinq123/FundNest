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
const selectedPlatformTenantId = ref("");
const selectedPlatformTenant = ref(null);
const selectedPlatformDonations = ref([]);
const selectedPlatformState = ref("idle");
const selectedPlatformError = ref("");

const loginForm = reactive({
  loginMode: "tenant",
  tenantSlug: session.value?.tenantSlug ?? "",
  email: session.value?.email ?? "",
  password: ""
});

const tenantConfigForm = reactive({
  brandColor: "#0f5ca8",
  logoUrl: "",
  currency: "GBP",
  donationPresetsText: "500,1000,2000,5000"
});
const changePasswordForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
});
const changePasswordState = ref("idle");
const changePasswordError = ref("");

const platformCreateForm = reactive({
  name: "New Charity",
  slug: "new-charity"
});

const createPlatformState = ref("idle");
const createPlatformError = ref("");
const createdTenantAdminInfo = ref(null);

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
  } else if (loginForm.email === "platform@fundnest.local") {
    loginForm.email = "";
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

async function changeTenantPassword() {
  changePasswordState.value = "saving";
  changePasswordError.value = "";

  if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
    changePasswordState.value = "error";
    changePasswordError.value = "New password and confirm password must match";
    return;
  }

  try {
    await apiRequest("/api/admin/change-password", {
      method: "POST",
      token: token.value,
      body: {
        currentPassword: changePasswordForm.currentPassword,
        newPassword: changePasswordForm.newPassword
      }
    });

    changePasswordState.value = "saved";
    changePasswordForm.currentPassword = "";
    changePasswordForm.newPassword = "";
    changePasswordForm.confirmPassword = "";
  } catch (err) {
    changePasswordState.value = "error";
    changePasswordError.value = err.message;
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

    if (selectedPlatformTenantId.value) {
      const exists = platformTenants.value.some(
        (tenant) => tenant.tenantId === selectedPlatformTenantId.value
      );
      if (exists) {
        await openPlatformTenant(selectedPlatformTenantId.value);
      } else {
        clearSelectedPlatformTenant();
      }
    }

    platformListState.value = "success";
  } catch (err) {
    platformListState.value = "error";
    platformError.value = err.message;
  }
}

function clearSelectedPlatformTenant() {
  selectedPlatformTenantId.value = "";
  selectedPlatformTenant.value = null;
  selectedPlatformDonations.value = [];
  selectedPlatformState.value = "idle";
  selectedPlatformError.value = "";
}

async function openPlatformTenant(tenantId) {
  selectedPlatformTenantId.value = tenantId;
  selectedPlatformState.value = "loading";
  selectedPlatformError.value = "";

  try {
    const [tenant, donationResult] = await Promise.all([
      apiRequest(`/api/platform/tenants/${tenantId}`, { token: token.value }),
      apiRequest(`/api/platform/tenants/${tenantId}/donations`, { token: token.value })
    ]);

    selectedPlatformTenant.value = tenant;
    selectedPlatformDonations.value = donationResult.donations ?? [];
    selectedPlatformState.value = "success";
  } catch (err) {
    selectedPlatformState.value = "error";
    selectedPlatformError.value = err.message;
  }
}

async function createPlatformTenant() {
  createPlatformState.value = "saving";
  createPlatformError.value = "";
  createdTenantAdminInfo.value = null;

  try {
    const created = await apiRequest("/api/platform/tenants", {
      method: "POST",
      token: token.value,
      body: {
        name: platformCreateForm.name,
        slug: slugify(platformCreateForm.slug)
      }
    });

    createdTenantAdminInfo.value = {
      slug: created.slug,
      email: created.tenantAdmin?.email ?? null,
      defaultPassword: created.tenantAdmin?.defaultPassword ?? "DemoAdmin123!"
    };

    createPlatformState.value = "saved";
    await loadPlatformTenants();
    await openPlatformTenant(created.tenantId);
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
    if (selectedPlatformTenantId.value === tenant.tenantId) {
      await openPlatformTenant(tenant.tenantId);
    }
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
    if (selectedPlatformTenantId.value === tenant.tenantId) {
      clearSelectedPlatformTenant();
    }
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
      clearSelectedPlatformTenant();
      await loadPlatformTenants();
    } else {
      platformTenants.value = [];
      clearSelectedPlatformTenant();
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
  changePasswordState.value = "idle";
  changePasswordError.value = "";
  changePasswordForm.currentPassword = "";
  changePasswordForm.newPassword = "";
  changePasswordForm.confirmPassword = "";
  platformTenants.value = [];
  platformError.value = "";
  platformListState.value = "idle";
  createPlatformState.value = "idle";
  createPlatformError.value = "";
  createdTenantAdminInfo.value = null;
  clearSelectedPlatformTenant();
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
      <h3>Change Password</h3>
      <form class="stack" @submit.prevent="changeTenantPassword">
        <label class="stack-sm">
          <span>Current Password</span>
          <input v-model="changePasswordForm.currentPassword" type="password" required />
        </label>
        <label class="stack-sm">
          <span>New Password</span>
          <input v-model="changePasswordForm.newPassword" type="password" required />
        </label>
        <label class="stack-sm">
          <span>Confirm New Password</span>
          <input v-model="changePasswordForm.confirmPassword" type="password" required />
        </label>

        <button class="btn" type="submit" :disabled="changePasswordState === 'saving'">
          {{ changePasswordState === "saving" ? "Updating..." : "Update Password" }}
        </button>
      </form>
      <p v-if="changePasswordState === 'saved'" class="success">Password updated.</p>
      <p v-if="changePasswordError" class="error">{{ changePasswordError }}</p>
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
      <p class="muted">
        New tenants are created with a default tenant-admin user. Default password:
        <code>DemoAdmin123!</code>
      </p>
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
      <div v-if="createdTenantAdminInfo" class="panel stack-sm">
        <p><strong>New tenant slug:</strong> <code>{{ createdTenantAdminInfo.slug }}</code></p>
        <p><strong>Tenant admin email:</strong> <code>{{ createdTenantAdminInfo.email }}</code></p>
        <p><strong>Default password:</strong> <code>{{ createdTenantAdminInfo.defaultPassword }}</code></p>
      </div>
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
                  <button
                    class="btn secondary btn-sm"
                    type="button"
                    @click="openPlatformTenant(tenant.tenantId)"
                  >
                    Manage
                  </button>
                  <RouterLink
                    v-if="!tenant.isArchived"
                    class="btn secondary btn-sm"
                    :to="`/c/${tenant.slug}`"
                  >
                    Public Page
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

    <section v-if="session && isPlatformAdmin && selectedPlatformTenantId" class="card stack">
      <div class="actions between">
        <h3>Tenant Management: {{ selectedPlatformTenant?.name ?? selectedPlatformTenantId }}</h3>
        <button class="btn secondary btn-sm" type="button" @click="clearSelectedPlatformTenant">
          Close
        </button>
      </div>

      <p v-if="selectedPlatformState === 'loading'">Loading tenant details...</p>
      <p v-if="selectedPlatformError" class="error">{{ selectedPlatformError }}</p>

      <template v-if="selectedPlatformState === 'success'">
        <div class="grid-2">
          <p><strong>Tenant ID:</strong> <code>{{ selectedPlatformTenant.tenantId }}</code></p>
          <p><strong>Slug:</strong> <code>{{ selectedPlatformTenant.slug }}</code></p>
          <p>
            <strong>Status:</strong>
            <span :class="selectedPlatformTenant.isArchived ? 'status-archived' : 'status-active'">
              {{ selectedPlatformTenant.isArchived ? "Archived" : "Active" }}
            </span>
          </p>
          <p><strong>Created:</strong> {{ new Date(selectedPlatformTenant.createdAt).toLocaleString() }}</p>
          <p><strong>Tenant Admin Email:</strong> {{ selectedPlatformTenant.tenantAdminEmail || "-" }}</p>
          <p><strong>Brand Color:</strong> {{ selectedPlatformTenant.config.brandColor }}</p>
          <p><strong>Currency:</strong> {{ selectedPlatformTenant.config.currency }}</p>
        </div>

        <div class="stack-sm">
          <h4>Donations ({{ selectedPlatformDonations.length }})</h4>
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
                <tr v-for="donation in selectedPlatformDonations" :key="donation.donationId">
                  <td>{{ new Date(donation.createdAt).toLocaleString() }}</td>
                  <td>{{ formatMinor(donation.amountMinor, donation.currency) }}</td>
                  <td>{{ donation.status }}</td>
                  <td>{{ donation.donorEmail || "-" }}</td>
                  <td><code>{{ donation.stripePaymentIntentId }}</code></td>
                </tr>
                <tr v-if="!selectedPlatformDonations.length">
                  <td colspan="5" class="muted">No donations for this tenant yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </section>
  </section>
</template>
