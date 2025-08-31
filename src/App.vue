<script setup>
import { useRoute, RouterLink, RouterView } from "vue-router";

const route = useRoute();

// أنيميشن خط ذهبي تحت الرابط + ستايل أساسي
const linkBase =
  "px-3 py-2 rounded-md text-sm text-slate-300 hover:text-slate-100 " +
  "border border-white/0 hover:border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/30";
const underline =
  "bg-gradient-to-r from-amber-400/80 to-amber-300/80 bg-no-repeat bg-left-bottom " +
  "bg-[length:0%_2px] hover:bg-[length:100%_2px] transition-[background-size] duration-300 ease-out";

function linkCls(isActive) {
  return [
    linkBase,
    underline,
    isActive ? "bg-[length:100%_2px] text-slate-100" : "",
  ].join(" ");
}
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-200"
  >
    <!-- Header -->
    <header
      class="sticky top-0 z-40 backdrop-blur bg-slate-950/60 supports-[backdrop-filter]:bg-slate-950/40 border-b border-white/10 relative hover:shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_10px_24px_-12px_rgba(251,191,36,0.25)] transition-shadow"
    >
      <!-- خط ذهبي رفيع أسفل الهيدر -->
      <div
        class="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"
      ></div>

      <nav class="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <!-- عنوان صغير بلمعة ذهبية -->
        <div class="flex items-center gap-2">
          <span
            class="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.35)]"
          ></span>
          <span class="text-slate-100 font-semibold tracking-wide"
            >لوحة الإشارات</span
          >
        </div>

        <!-- روابط -->
        <div class="ml-auto flex items-center gap-2">
          <RouterLink to="/" custom v-slot="{ isActive, navigate }">
            <button :class="linkCls(isActive)" @click="navigate">
              🏠 الرئيسية
            </button>
          </RouterLink>
          <RouterLink to="/about" custom v-slot="{ isActive, navigate }">
            <button :class="linkCls(isActive)" @click="navigate">
              ℹ️ عن التطبيق
            </button>
          </RouterLink>
          <RouterLink to="/signals" custom v-slot="{ isActive, navigate }">
            <button :class="linkCls(isActive)" @click="navigate">
              📡 الإشارات
            </button>
          </RouterLink>
        </div>
      </nav>
    </header>

    <!-- المحتوى: Full-Width لو الراوت يحمل meta.fullWidth -->
    <main :class="route.meta.fullWidth ? 'p-0' : 'max-w-6xl mx-auto p-4'">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* كله عبر Tailwind */
</style>
