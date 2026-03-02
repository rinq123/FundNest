<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { apiRequest } from "../lib/api";

const props = defineProps({
  slug: {
    type: String,
    required: true
  }
});

const loading = ref(true);
const error = ref("");
const tenant = ref(null);
const submitState = ref("idle");
const submitError = ref("");
const donationResponse = ref(null);

const form = reactive({
  amountMinor: 2500,
  donorEmail: ""
});

const presets = computed(() => tenant.value?.config?.donationPresets ?? []);

function formatMinor(amount, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency
  }).format((Number(amount) || 0) / 100);
}

async function loadTenant() {
  loading.value = true;
  error.value = "";

  try {
    tenant.value = await apiRequest(`/api/public/tenants/${props.slug}`);

    if (Array.isArray(tenant.value?.config?.donationPresets) && tenant.value.config.donationPresets.length) {
      form.amountMinor = tenant.value.config.donationPresets[0];
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function createDonation() {
  submitError.value = "";
  donationResponse.value = null;
  submitState.value = "submitting";

  try {
    donationResponse.value = await apiRequest("/api/public/donations", {
      method: "POST",
      body: {
        tenantSlug: props.slug,
        amountMinor: Number(form.amountMinor),
        donorEmail: form.donorEmail || undefined
      }
    });

    submitState.value = "success";
  } catch (err) {
    submitError.value = err.message;
    submitState.value = "error";
  }
}

onMounted(loadTenant);
</script>

<template>
  <section class="card stack">
    <template v-if="loading">
      <p>Loading tenant page...</p>
    </template>

    <template v-else-if="error">
      <p class="error">{{ error }}</p>
    </template>

    <template v-else>
      <h2>{{ tenant.name }}</h2>
      <p>Public donation page for tenant slug: <code>{{ tenant.slug }}</code></p>

      <div class="tenant-badge" :style="{ borderColor: tenant.config.brandColor }">
        <span :style="{ background: tenant.config.brandColor }" class="swatch" />
        <span>Brand color: {{ tenant.config.brandColor }}</span>
      </div>

      <form class="stack" @submit.prevent="createDonation">
        <label class="stack-sm">
          <span>Donation Amount (minor units)</span>
          <input v-model.number="form.amountMinor" type="number" min="1" required />
        </label>

        <div v-if="presets.length" class="preset-row">
          <button
            v-for="preset in presets"
            :key="preset"
            class="chip"
            type="button"
            @click="form.amountMinor = preset"
          >
            {{ formatMinor(preset, tenant.config.currency) }}
          </button>
        </div>

        <label class="stack-sm">
          <span>Donor Email (optional)</span>
          <input v-model.trim="form.donorEmail" type="email" placeholder="donor@example.com" />
        </label>

        <button class="btn" type="submit" :disabled="submitState === 'submitting'">
          {{ submitState === "submitting" ? "Creating Payment Intent..." : "Create Donation Intent" }}
        </button>
      </form>

      <p v-if="submitError" class="error">{{ submitError }}</p>

      <div v-if="donationResponse" class="stack-sm panel">
        <h3>Donation Intent Created</h3>
        <p><strong>Status:</strong> {{ donationResponse.status }}</p>
        <p><strong>Provider:</strong> {{ donationResponse.paymentProvider }}</p>
        <p><strong>PaymentIntent:</strong> <code>{{ donationResponse.stripePaymentIntentId }}</code></p>
        <p><strong>Client Secret:</strong> <code>{{ donationResponse.clientSecret }}</code></p>
      </div>
    </template>
  </section>
</template>
