<template>
  <div class="p-4">
    <!-- بانر قيود الأهلية من بايننس -->
    <div
      v-if="lastError && /Eligibility|restricted location/i.test(lastError)"
      class="mx-6 mt-2 p-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-900"
    >
      تم رفض الطلب بسبب القيود الجغرافية. إن كنت داخل الولايات المتحدة اضغط:
      <button
        type="button"
        class="ml-2 px-3 py-1.5 rounded-xl border bg-white"
        @click="quickSwitchToUS"
        :disabled="busy"
      >
        التحويل إلى Binance.US + Spot وإعادة الاتصال
      </button>
    </div>

    <!-- شريط تحكم Binance + عرض/نسخ/تحديث IP -->

    <!-- أزرار التحكم والحالة -->
    <div class="mb-3 flex items-center gap-2">
      <button
        @click="start"
        :disabled="!hasElectron || busy"
        class="px-3 py-1.5 rounded-xl border"
      >
        ▶️ Start
      </button>
      <button
        @click="stop"
        :disabled="!hasElectron"
        class="px-3 py-1.5 rounded-xl border"
      >
        ⏹ Stop
      </button>
      <span class="text-sm" :class="statusClass">
        {{
          hasElectron
            ? "status: " + (status || "ready")
            : "Electron API not found — افتح التطبيق عبر Electron"
        }}
      </span>
    </div>

    <!-- إدخال اسم القناة/اليوزر + أزرار التحكم -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <input
        v-model="targetInput"
        @keydown.enter.prevent="listen"
        :disabled="!hasElectron"
        placeholder="اكتب اسم القناة أو @username (مثال: my_signals_channel)"
        class="px-3 py-1.5 border rounded-xl min-w-[320px]"
      />
      <button
        @click="listen"
        :disabled="!hasElectron || !targetInput.trim()"
        class="px-3 py-1.5 rounded-xl border bg-white"
      >
        📡 استمع
      </button>
      <button
        @click="refreshTargets"
        :disabled="!hasElectron"
        class="px-3 py-1.5 rounded-xl border bg-white"
      >
        🔄 تحديث الأهداف
      </button>
      <span class="text-xs text-gray-600"
        >الأهداف الحالية: <b>{{ targets.join(", ") || "—" }}</b></span
      >
    </div>

    <!-- فورم تسجيل الدخول التفاعلي (كود/2FA) -->
    <div
      v-if="login.needCode || login.needPassword"
      class="mb-3 p-3 border rounded-xl bg-amber-50"
    >
      <div class="font-medium mb-1">
        تسجيل الدخول مطلوب للحساب:
        <span class="font-mono">{{ login.phone || "(غير معروف)" }}</span>
      </div>
      <p v-if="login.msg" class="text-xs text-amber-800 mb-2">
        {{ login.msg }}
      </p>

      <div v-if="login.needCode" class="flex items-center gap-2 mb-2">
        <input
          v-model="login.code"
          @keydown.enter.prevent="submitCode"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="أدخل كود التفعيل (5/6 أرقام)"
          class="px-3 py-1.5 border rounded w-56"
        />
        <button @click="submitCode" class="px-3 py-1.5 rounded border bg-white">
          إرسال الكود
        </button>
      </div>

      <div v-if="login.needPassword" class="flex items-center gap-2">
        <input
          v-model="login.password"
          @keydown.enter.prevent="submitPassword"
          type="password"
          placeholder="أدخل كلمة مرور 2FA"
          class="px-3 py-1.5 border rounded w-64"
        />
        <button
          @click="submitPassword"
          class="px-3 py-1.5 rounded border bg-white"
        >
          إرسال كلمة المرور
        </button>
      </div>

      <div class="text-xs text-gray-600 mt-2">
        * سيتم استخدام القيم لمرة واحدة لتوليد جلسة محلية آمنة.
      </div>
    </div>

    <!-- جدول الإشارات -->
    <div class="overflow-auto max-h-[70vh] border rounded-xl bg-white">
      <table class="min-w-full text-sm">
        <thead class="sticky top-0 bg-white">
          <tr class="text-left">
            <th class="p-2">Time (UTC)</th>
            <th class="p-2">Peer</th>
            <th class="p-2">Side</th>
            <th class="p-2">Pair</th>
            <th class="p-2">Entry</th>
            <th class="p-2">TP1</th>
            <th class="p-2">TP2</th>
            <th class="p-2">TP3</th>
            <th class="p-2">SL</th>
            <th class="p-2">TF</th>
            <th class="p-2">Vol</th>
            <th class="p-2">Msg#</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r._key" class="border-t">
            <td class="p-2 whitespace-nowrap">{{ niceTime(r.date_iso) }}</td>
            <td class="p-2">{{ r.peer }}</td>
            <td class="p-2">
              <span :class="badgeClass(r.side)">{{ r.side }}</span>
            </td>
            <td class="p-2">{{ r.pair || r.symbol }}</td>
            <td class="p-2">{{ r.entry_from }} – {{ r.entry_to }}</td>
            <td class="p-2">{{ r.tp1 }}</td>
            <td class="p-2">{{ r.tp2 }}</td>
            <td class="p-2">{{ r.tp3 }}</td>
            <td class="p-2">{{ r.sl }}</td>
            <td class="p-2">{{ r.timeframe || "-" }}</td>
            <td class="p-2">{{ formatNum(r.volume) }}</td>
            <td class="p-2">{{ r.message_id }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- لوج داخلي -->
    <details class="mt-3 text-xs text-gray-500">
      <summary>Log</summary>
      <pre class="whitespace-pre-wrap">{{ metaLog.join("\n") }}</pre>
    </details>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, computed } from "vue";

const rows = ref([]);
const status = ref("");
const metaLog = ref([]);
const busy = ref(false);

/* Binance state + IP */
const binance = reactive({ domain: "", mode: "", proxy: "" });
const binanceStatus = ref("");
const publicIP = ref("");
const lastError = ref(""); // لرسائل مثل Eligibility

/* هدف الإدخال الحالي + قائمة الأهداف */
const targetInput = ref(localStorage.getItem("signals:lastTarget") || "");
const targets = ref([]);

const login = ref({
  phone: "",
  needCode: false,
  needPassword: false,
  code: "",
  password: "",
  msg: "",
});
const hasElectron = typeof window !== "undefined" && !!window.signals;
const seen = new Set();

function niceTime(iso) {
  try {
    return new Date(iso).toISOString().replace("T", " ").replace("Z", "");
  } catch {
    return iso;
  }
}
function formatNum(v) {
  if (v == null || Number.isNaN(v)) return "-";
  try {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
      v
    );
  } catch {
    return String(v);
  }
}
function badgeClass(side) {
  const base = "px-2 py-0.5 rounded-full text-xs";
  return side === "BUY"
    ? base + " bg-green-100 text-green-700"
    : base + " bg-red-100 text-red-700";
}
function pushRow(r) {
  const key = `${r.message_id}|${r.date_iso}|${r.peer || ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  r._key = key;
  rows.value.unshift(r);
  if (rows.value.length > 1000) rows.value.pop();
}
function onNew(row) {
  pushRow(row);
}

function clearLoginUI() {
  login.value.needCode = false;
  login.value.needPassword = false;
  login.value.msg = "";
  login.value.code = "";
  login.value.password = "";
}

function onMeta(meta) {
  metaLog.value.push(JSON.stringify(meta));
  const t = meta?.type;

  if (t === "status") {
    const st = meta.data?.stage || "";
    status.value = st;
    busy.value = st === "starting";
    if (
      st === "started" ||
      st === "already_authorized" ||
      st.includes("listening")
    )
      clearLoginUI();
  } else if (t === "stderr" || t === "spawn_error" || t === "parse_error") {
    status.value = "error";
  } else if (t === "login_code_required") {
    login.value.phone = meta.data?.phone || "";
    login.value.needCode = true;
    login.value.msg = "أدخل كود التفعيل المرسل عبر تيليجرام";
    status.value = "awaiting_code";
  } else if (t === "login_code_invalid") {
    login.value.needCode = true;
    login.value.msg = "الكود غير صحيح، حاول مرة أخرى.";
    status.value = "code_invalid";
  } else if (t === "login_code_expired") {
    login.value.needCode = true;
    login.value.msg = "انتهت صلاحية الكود. سيتم إرسال كود جديد تلقائيًا.";
    status.value = "code_expired";
  } else if (t === "login_password_required") {
    login.value.needPassword = true;
    login.value.msg = "أدخل كلمة مرور التحقق بخطوتين (2FA)";
    status.value = "awaiting_password";
  } else if (t === "login_error") {
    status.value = "error";
    const kind = meta.data?.kind;
    if (kind === "invalid_phone")
      login.value.msg = "رقم الهاتف غير صالح في .env";
    else if (kind === "phone_banned")
      login.value.msg = "هذا الرقم محظور من تيليجرام";
    else if (kind === "bad_password")
      login.value.msg = "كلمة المرور 2FA غير صحيحة";
    else if (kind === "timeout_code") login.value.msg = "انتهى وقت إدخال الكود";
    else if (kind === "timeout_password")
      login.value.msg = "انتهى وقت إدخال كلمة المرور";
  } else if (t === "listening") {
    clearLoginUI();
    status.value = "listening";
    if (Array.isArray(meta.data?.targets)) targets.value = meta.data.targets;
  } else if (t === "targets") {
    const arr = meta.data?.resolved || meta.data?.raw || [];
    if (Array.isArray(arr)) targets.value = arr;
  } else if (t === "targets_updated") {
    const res = meta.data?.resolved?.map((x) => x.resolved) || [];
    if (res.length) targets.value = res;
  }

  if (t === "binance_error" && meta.data?.msg) {
    lastError.value = String(meta.data.msg);
  }
}

/* تحميل إعدادات Binance الحالية للعرض + proxy إن وُجد */
async function loadBinanceCfg() {
  try {
    if (!window.binance?.load) return;
    const cfg = await window.binance.load();
    if (cfg) {
      binance.domain = cfg.domain || "";
      binance.mode = cfg.mode || "";
      binance.proxy = cfg.proxy || "";
    }
  } catch {}
}

/* جلب/تحديث الـ IP بفولباكات متعددة */
async function refreshIP() {
  try {
    publicIP.value = "";

    // (اختياري) من الخلفية لو متوفّر ويدعم Proxy
    if (window.net?.publicIP) {
      const r = await window.net.publicIP(binance.proxy || "");
      if (r?.ok && r.ip) {
        publicIP.value = r.ip;
        metaLog.value.push("Public IP (backend): " + r.ip);
        return;
      }
    }

    // فولباك من الواجهة
    const providers = [
      async () =>
        (await (await fetch("https://api.ipify.org?format=json")).json()).ip,
      async () =>
        (await (await fetch("https://ipv4.icanhazip.com")).text()).trim(),
      async () => (await (await fetch("https://ifconfig.me/ip")).text()).trim(),
    ];
    for (const p of providers) {
      try {
        const ip = await p();
        if (ip) {
          publicIP.value = ip;
          metaLog.value.push("Public IP: " + ip);
          return;
        }
      } catch {}
    }
    throw new Error("No IP service responded");
  } catch (e) {
    metaLog.value.push("IP fetch error: " + String(e));
  }
}

/* نسخ IP الحالي */
async function copyMyIP() {
  try {
    if (!publicIP.value) await refreshIP();
    if (!publicIP.value) throw new Error("لا يوجد IP متاح");
    await navigator.clipboard.writeText(publicIP.value);
    metaLog.value.push("Public IP copied: " + publicIP.value);
    alert("تم النسخ: " + publicIP.value);
  } catch (e) {
    alert("تعذّر نسخ IP: " + String(e));
  }
}

/* التبديل المحفوظ + اختبار اتصال */
async function switchTo(domain, mode) {
  if (!window.binance?.update || !window.binance?.test) {
    binanceStatus.value = "لا يوجد معالج خلفي للاتصال";
    return;
  }
  try {
    busy.value = true;
    binanceStatus.value = "تبديل الإعدادات…";
    const u = await window.binance.update({ domain, mode });
    if (!u?.ok) {
      const msg = String(u?.error || "فشل التحديث");
      lastError.value = msg;
      binanceStatus.value = msg;
      return;
    }
    binance.domain = u.pub?.domain || domain;
    binance.mode = u.pub?.mode || mode;

    binanceStatus.value = "اختبار الاتصال…";
    const res = await window.binance.test({});
    if (res?.ok) {
      lastError.value = "";
      binanceStatus.value = "تم التبديل والاتصال ✅";
    } else {
      const msg = String(res?.error || "فشل الاتصال");
      lastError.value = msg;
      binanceStatus.value = "فشل الاتصال: " + msg;
    }

    // حدّث IP بعد أي تغيير
    await loadBinanceCfg();
    await refreshIP();
  } catch (e) {
    const msg = String(e);
    lastError.value = msg;
    binanceStatus.value = "خطأ: " + msg;
  } finally {
    busy.value = false;
  }
}

/* زر سريع: US + Spot */
async function quickSwitchToUS() {
  await switchTo("binance.us", "spot");
}

async function submitCode() {
  if (!hasElectron || !login.value.code) return;
  await window.signals?.sendCode(login.value.code);
  login.value.code = "";
}
async function submitPassword() {
  if (!hasElectron || !login.value.password) return;
  await window.signals?.sendPassword(login.value.password);
  login.value.password = "";
}

async function start() {
  if (!hasElectron) return;
  busy.value = true;
  try {
    await window.signals.start();
  } finally {
    busy.value = false;
  }
}
async function stop() {
  if (!hasElectron) return;
  try {
    await window.signals.stop();
  } catch {}
}

/* الاستماع لقناة/يوزر من الحقل */
async function listen() {
  if (!hasElectron) return;
  const name = targetInput.value.trim();
  if (!name) return;

  clearSignals();
  localStorage.setItem("signals:lastTarget", name);
  try {
    await window.signals.setTarget(name);
    await refreshTargets();
    status.value = "listening";
  } catch (e) {
    metaLog.value.push("listen error: " + String(e));
  }
}

/* جلب الأهداف الحالية من البوت */
async function refreshTargets() {
  if (!hasElectron) return;
  try {
    await window.signals.listTargets();
  } catch {}
}

/* تنظيف الجدول */
function clearSignals() {
  rows.value = [];
  seen.clear();
}

onMounted(async () => {
  if (hasElectron) {
    window.signals.onNew(onNew);
    window.signals.onMeta(onMeta);
    start();
    refreshTargets();
    await loadBinanceCfg();
  }
  await refreshIP(); // جلب الـ IP دائماً
});

onBeforeUnmount(() => {
  if (!hasElectron) return;
  stop();
  try {
    window.signals.offNew?.(onNew);
  } catch {}
  try {
    window.signals.offMeta?.(onMeta);
  } catch {}
});

const statusClass = computed(() =>
  status.value.includes("listening") ||
  status.value.includes("started") ||
  status.value.includes("already_authorized")
    ? "text-green-600"
    : status.value.includes("starting") || status.value.includes("awaiting")
    ? "text-amber-600"
    : status.value.includes("error")
    ? "text-red-600"
    : "text-gray-500"
);
</script>

<style scoped>
table {
  border-collapse: separate;
  border-spacing: 0;
}
</style>
