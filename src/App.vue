

<!-- src/App.vue -->
<script setup>
</script>

<!-- src/App.vue -->


<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <header class="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <nav class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <RouterLink to="/" class="px-3 py-1 rounded hover:bg-slate-100">🏠 الرئيسية</RouterLink>
        <RouterLink to="/about" class="px-3 py-1 rounded hover:bg-slate-100">ℹ️ عن التطبيق</RouterLink>
        <RouterLink to="/signals" class="px-3 py-1 rounded hover:bg-slate-100">📡 الإشارات</RouterLink>

      </nav>
    </header>
    <main class="max-w-6xl mx-auto p-4">
      <RouterView />
    </main>
  </div>
</template>



<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
