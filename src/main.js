import { createApp } from 'vue'
import App from './App.vue'

// ✅ استيراد Tailwind (اللي عملناه بـ src/assets/main.css)
import './assets/main.css'

// ✅ استيراد الراوتر
import router from './router'

const app = createApp(App)

// استخدام الراوتر
app.use(router)

// ربط التطبيق
app.mount('#app')
