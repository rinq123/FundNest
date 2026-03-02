import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import CharityView from "../views/CharityView.vue";
import AdminView from "../views/AdminView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/c/:slug", name: "charity", component: CharityView, props: true },
    { path: "/admin", name: "admin", component: AdminView }
  ]
});

export default router;
