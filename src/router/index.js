import { createRouter, createWebHashHistory } from "vue-router";

const Home = () => import("../views/Home.vue");
const About = () => import("../views/About.vue");
const Signals = () => import("../views/SignalsTable.vue"); // 👈 جديد

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: Home },
    {
      path: "/about",
      name: "about",
      component: About,
      meta: { fullWidth: true },
    },
    {
      path: "/signals",
      name: "signals",
      component: Signals,
      meta: { fullWidth: true },
    }, // 👈 جديد
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
