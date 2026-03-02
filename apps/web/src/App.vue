<template>
  <div class="page-shell">
    <header class="topbar">
      <h1>FundNest</h1>
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/c/demo-charity">Tenant Page</RouterLink>
        <RouterLink to="/admin">Admin</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>
