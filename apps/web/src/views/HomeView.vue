<template>
  <section class="stack">
    <section class="card stack">
      <h2>FundNest Platform</h2>
      <p>
        Multi-tenant donation platform demo. Use the links below to open a public tenant page or
        the unified admin console.
      </p>

      <div class="actions">
        <RouterLink class="btn" to="/c/demo-charity">
          Open Demo Charity Page
        </RouterLink>
        <RouterLink class="btn secondary" to="/admin">
          Open Admin Console
        </RouterLink>
      </div>
    </section>

    <section class="card stack">
      <h3>Demo Logins</h3>
      <p class="muted">Tenant admin:</p>
      <p><code>tenantSlug: demo-charity</code></p>
      <p><code>email: admin@democharity.local</code></p>
      <p><code>password: DemoAdmin123!</code></p>

      <p class="muted">Platform admin:</p>
      <p><code>email: platform@fundnest.local</code></p>
      <p><code>password: DemoPlatform123!</code></p>
    </section>
  </section>
</template>
