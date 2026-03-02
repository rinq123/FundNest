<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiRequest } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/session";

const session = ref(loadSession());
const authError = ref("");
const loading = ref(false);
const me = ref(null);
const donations = ref([]);
const dashboardError = ref("");
const saveConfigState = ref("idle");
const saveConfigError = ref("");

const loginForm = reactive({
  tenantSlug: session.value?.tenantSlug ?? "demo-charity",
  email: session.value?.email ?? "admin@democharity.local",
  password: ""
});

const configForm = reactive({
  brandColor: "#0f5ca8",
  logoUrl: "",
  currency: "GBP",
  donationPresetsText: "500,1000,2000,5000"
});

const token = computed(() => session.value?.accessToken ?? "");

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

async function loadDashboard() {
  if (!token.value) {
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
    configForm.brandColor = tenantResponse.config.brandColor ?? "#0f5ca8";
    configForm.logoUrl = tenantResponse.config.logoUrl ?? "";
    configForm.currency = tenantResponse.config.currency ?? "GBP";
    configForm.donationPresetsText = (tenantResponse.config.donationPresets ?? []).join(",");
  } catch (err) {
    dashboardError.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function login() {
  authError.value = "";

  try {
    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: {
        tenantSlug: loginForm.tenantSlug,
        email: loginForm.email,
        password: loginForm.password
      }
    });

    session.value = {
      accessToken: response.accessToken,
      tenantSlug: response.user.tenantSlug,
      email: response.user.email
    };
    saveSession(session.value);

    loginForm.password = "";
    await loadDashboard();
  } catch (err) {
    authError.value = err.message;
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
}

async function saveConfig() {
  saveConfigState.value = "saving";
  saveConfigError.value = "";

  try {
    const presets = parsePresets(configForm.donationPresetsText);

    await apiRequest("/api/admin/config", {
      method: "PATCH",
      token: token.value,
      body: {
        brandColor: configForm.brandColor,
        logoUrl: configForm.logoUrl || null,
        currency: configForm.currency,
        donationPresets: presets
      }
    });

    saveConfigState.value = "saved";
    await loadDashboard();
  } catch (err) {
    saveConfigState.value = "error";
    saveConfigError.value = err.message;
  }
}

onMounted(loadDashboard);
</script>

<template>
  <section class="stack">
    <section class="card stack">
      <h2>Tenant Admin</h2>

      <template v-if="!session">
        <form class="stack" @submit.prevent="login">
          <label class="stack-sm">
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

          <button class="btn" type="submit">Login</button>
        </form>

        <p v-if="authError" class="error">{{ authError }}</p>
      </template>

      <template v-else>
        <div class="actions">
          <p class="muted">Authenticated as <strong>{{ me?.email ?? session.email }}</strong></p>
          <button class="btn secondary" @click="logout">Logout</button>
        </div>

        <p v-if="loading">Loading dashboard...</p>
        <p v-if="dashboardError" class="error">{{ dashboardError }}</p>
      </template>
    </section>

    <section v-if="session && me" class="card stack">
      <h3>Tenant Overview</h3>
      <p><strong>Tenant:</strong> {{ me.tenantSlug }}</p>
      <p><strong>Donation Count:</strong> {{ donations.length }}</p>
    </section>

    <section v-if="session && me" class="card stack">
      <h3>Branding Configuration</h3>

      <form class="stack" @submit.prevent="saveConfig">
        <label class="stack-sm">
          <span>Brand Color</span>
          <input v-model.trim="configForm.brandColor" required />
        </label>

        <label class="stack-sm">
          <span>Logo URL (optional)</span>
          <input v-model.trim="configForm.logoUrl" />
        </label>

        <label class="stack-sm">
          <span>Currency (3-letter code)</span>
          <input v-model.trim="configForm.currency" maxlength="3" required />
        </label>

        <label class="stack-sm">
          <span>Donation Presets (minor units, comma-separated)</span>
          <input v-model="configForm.donationPresetsText" placeholder="500,1000,2500" />
        </label>

        <button class="btn" type="submit">Save Config</button>
      </form>

      <p v-if="saveConfigState === 'saved'" class="success">Config updated.</p>
      <p v-if="saveConfigError" class="error">{{ saveConfigError }}</p>
    </section>

    <section v-if="session && me" class="card stack">
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
  </section>
</template>
