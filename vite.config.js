// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',              // ✅ يخلي المسارات نسبية لتشتغل مع file://
  plugins: [vue()],
  build: { outDir: 'dist' }
})