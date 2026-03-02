<script setup>
defineProps({
  slug: {
    type: String,
    required: true
  }
});
</script>

<template>
  <section class="card">
    <h2>Tenant Donation Page</h2>
    <p>Route param: <code>{{ slug }}</code></p>
    <p>This will become the public donation page for each tenant.</p>
  </section>
</template>
