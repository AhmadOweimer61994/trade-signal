<template>
  <div class="p-4 space-y-3">
    <div class="flex items-center gap-2">
      <input v-model="target" placeholder="اسم القناة أو @username" class="border rounded px-3 py-1.5 w-80" />
      <button @click="listen" class="border rounded px-3 py-1.5">استمع</button>
      <button @click="listTargets" class="border rounded px-3 py-1.5">عرض الأهداف</button>
    </div>

    <div class="text-sm text-gray-600">الأهداف الحالية: {{ targets.join(', ') || '—' }}</div>

    <div class="border rounded p-2 h-56 overflow-auto">
      <div v-for="(s, i) in signals" :key="i" class="border-b pb-1 mb-1">
        <div class="text-xs opacity-70">{{ s.type }}</div>
        <pre class="text-xs whitespace-pre-wrap">{{ s.data }}</pre>
      </div>
    </div>

    <!-- لو طُلِب كود/باسوورد من تيليجرام -->
    <div v-if="login.needCode" class="p-2 bg-amber-50 border rounded">
      <div class="mb-1">أدخل كود تيليجرام المرسل لرقمك:</div>
      <input v-model="login.code" class="border rounded px-2 py-1 mr-2" />
      <button @click="sendCode" class="border rounded px-2 py-1">إرسال الكود</button>
    </div>
    <div v-if="login.needPassword" class="p-2 bg-amber-50 border rounded">
      <div class="mb-1">أدخل كلمة مرور 2FA:</div>
      <input v-model="login.password" type="password" class="border rounded px-2 py-1 mr-2" />
      <button @click="sendPassword" class="border rounded px-2 py-1">إرسال</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const target = ref('')
const targets = ref<string[]>([])
const signals = ref<{type: string, data: any}[]>([])
const login = ref({ needCode: false, code: '', needPassword: false, password: '' })

const hasBot = !!window.posAPI?.bot

onMounted(() => {
  if (!hasBot) return
  window.posAPI!.bot.start()
  window.posAPI!.bot.onSig((obj) => {
    // obj = {type, data}
    if (obj.type === 'listening') {
      targets.value = obj.data.targets || []
    }
    if (obj.type === 'targets') {
      targets.value = obj.data.resolved || obj.data.raw || []
    }
    if (obj.type === 'targets_updated') {
      // تحديث ناجح
    }
    if (obj.type === 'signal') {
      signals.value.unshift({ type: 'signal', data: obj.data })
    }
    if (obj.type === 'login_code_required') {
      login.value.needCode = true; login.value.needPassword = false
    }
    if (obj.type === 'login_password_required') {
      login.value.needPassword = true; login.value.needCode = false
    }
  })
})

async function listen() {
  if (!target.value.trim()) return
  await window.posAPI!.bot.setTargets([target.value.trim()])
  await listTargets()
}

async function listTargets() {
  await window.posAPI!.bot.listTargets()
}

function sendCode() {
  window.posAPI!.bot.sendCode(login.value.code || '')
}
function sendPassword() {
  window.posAPI!.bot.sendPassword(login.value.password || '')
}
</script>
