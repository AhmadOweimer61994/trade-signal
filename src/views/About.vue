<template>
  <div class="min-h-screen p-6">
    <div class="mx-auto w-full max-w-6xl grid gap-6 xl:grid-cols-[2fr_1fr]">
      <!-- بطاقة: المعرّف + الرصيد -->
      <!-- نظرة عامة على الحساب -->
      <!-- خانة USDT صغيرة فقط -->
      <!-- خانة USDT صغيرة -->
      <div class="mt-4 p-3 border rounded-2xl bg-emerald-50/60">
        <div class="text-xs text-emerald-700">الرصيد (USDT)</div>
        <div class="flex items-baseline gap-2">
          <div class="text-2xl font-semibold">{{ formatNum(usdtTotal) }}</div>
          <div class="text-[11px] text-emerald-700">
            Free: {{ formatNum(usdtFree) }} • Hold: {{ formatNum(usdtHold) }}
          </div>
        </div>
      </div>

      <div class="mt-4 p-3 border rounded-2xl bg-slate-50">
        <div class="text-sm mb-1">
          الحساب: <b>{{ overview.label || "—" }}</b>
          <span v-if="overview.id" class="text-xs text-slate-500"
            >({{ overview.id }})</span
          >
        </div>
        <div class="text-[11px] text-slate-500 mb-2">
          * Binance API لا يوفّر اسم صاحب الحساب عبر المفاتيح. نعرض مُعرّفًا
          مختصرًا بدلًا منه.
        </div>

        <div v-if="overview.balances.length" class="max-h-44 overflow-auto">
          <table class="w-full text-xs">
            <thead>
              <tr>
                <th class="text-left p-1">Asset</th>
                <th class="text-right p-1">Free</th>
                <th class="text-right p-1">Locked</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in overview.balances" :key="b.asset">
                <td class="p-1">{{ b.asset }}</td>
                <td class="p-1 text-right">{{ b.free }}</td>
                <td class="p-1 text-right">{{ b.locked ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-xs text-slate-500">
          لا توجد أرصدة ظاهرة (قد تكون 0).
        </div>
      </div>

      <!-- النموذج -->
      <section
        class="bg-white rounded-2xl shadow border relative overflow-hidden"
      >
        <div class="px-6 pt-6 pb-3 border-b">
          <h1 class="text-2xl font-semibold">إعدادات بايننس (Mainnet فقط)</h1>
          <p class="text-slate-600 mt-1">
            أدخل مفاتيحك — الاتصال يكون فورًا على الشبكة الحية.
          </p>
        </div>

        <div
          v-if="notice"
          class="mx-6 mt-4 p-3 rounded-xl border"
          :class="
            notice.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          "
        >
          {{ notice.msg }}
        </div>

        <form class="p-6 space-y-8" @submit.prevent="saveThenConnect">
          <!-- المفاتيح -->
          <div>
            <h2 class="text-lg font-semibold mb-3">المفاتيح</h2>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm font-medium mb-1">API Key</label>
                <input
                  v-model.trim="form.apiKey"
                  placeholder="BK3…"
                  class="w-full px-4 py-3 border rounded-2xl text-base"
                />
                <p class="text-xs text-slate-500 mt-1">
                  تأكد من الصلاحيات المناسبة (Spot/Futures).
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">API Secret</label>
                <div class="flex gap-2">
                  <input
                    :type="showSecret ? 'text' : 'password'"
                    v-model.trim="form.apiSecret"
                    placeholder="••••••••"
                    class="w-full px-4 py-3 border rounded-2xl text-base"
                  />
                  <button
                    type="button"
                    class="px-3 py-2 border rounded-xl"
                    @click="showSecret = !showSecret"
                  >
                    {{ showSecret ? "إخفاء" : "إظهار" }}
                  </button>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <input
                    id="rememberKeys"
                    type="checkbox"
                    v-model="rememberKeys"
                    class="h-4 w-4"
                  />
                  <label for="rememberKeys" class="text-xs text-slate-600">
                    تذكّر تعبئة المفاتيح في هذه الواجهة (يُخزَّن محليًا على هذا
                    الجهاز)
                  </label>
                </div>
                <p class="text-xs text-slate-500 mt-1">
                  السر محفوظ مشفّرًا في الخلفية؛ الخيار أعلاه فقط لتعبئة الحقول
                  تلقائيًا محليًا.
                </p>
              </div>
            </div>
          </div>

          <!-- الشبكة (Mainnet فقط) -->
          <div>
            <h2 class="text-lg font-semibold mb-3">الشبكة</h2>
            <div class="grid gap-4 md:grid-cols-3">
              <div>
                <label class="block text-sm font-medium mb-1">النطاق</label>
                <select
                  v-model="form.domain"
                  class="w-full px-4 py-3 border rounded-2xl text-base"
                >
                  <option value="binance.com">binance.com</option>
                  <option value="binance.us">binance.us</option>
                </select>
                <p class="text-xs text-slate-500 mt-1">
                  binance.us عادةً بدون Futures.
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">الوضع</label>
                <select
                  v-model="form.mode"
                  :disabled="form.domain === 'binance.us'"
                  class="w-full px-4 py-3 border rounded-2xl text-base"
                >
                  <option value="spot">Spot</option>
                  <option value="futures">USDT-M Futures</option>
                </select>
                <p
                  v-if="form.domain === 'binance.us'"
                  class="text-xs text-amber-700 mt-1"
                >
                  Futures غير مدعومة.
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1"
                  >Base URL (للعلم)</label
                >
                <input
                  :value="baseUrl"
                  class="w-full px-4 py-3 border rounded-2xl text-base bg-slate-50"
                  readonly
                />
                <p class="text-xs text-slate-500 mt-1">
                  العنوان يُحدّد تلقائياً حسب النطاق والوضع.
                </p>
              </div>
            </div>

            <!-- IP العمومي + أزرار تحديث/نسخ -->
            <div
              class="mt-4 p-3 border rounded-2xl bg-slate-50 flex flex-wrap items-center gap-2"
            >
              <span class="text-sm"
                >IP: <b>{{ publicIP || "—" }}</b></span
              >
              <button
                type="button"
                class="px-3 py-1.5 rounded-xl border bg-white"
                :disabled="ipBusy"
                @click="refreshIP"
              >
                🔁 تحديث IP
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-xl border bg-white"
                :disabled="!publicIP"
                @click="copyIP"
              >
                📋 نسخ
              </button>
              <span class="ms-auto text-xs text-slate-500"
                >أضِف هذا الـ IP في Trusted IPs لمفتاحك إن كان مقيّدًا.</span
              >
            </div>
          </div>

          <!-- متقدم -->
          <div>
            <h2 class="text-lg font-semibold mb-3">خيارات متقدمة</h2>
            <div class="grid gap-4 md:grid-cols-3">
              <div>
                <label class="block text-sm font-medium mb-1"
                  >recvWindow (ms)</label
                >
                <input
                  v-model.number="form.recvWindow"
                  type="number"
                  min="1000"
                  step="500"
                  class="w-full px-4 py-3 border rounded-2xl text-base"
                />
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-1"
                  >Proxy (اختياري)</label
                >
                <input
                  v-model.trim="form.proxy"
                  placeholder="http://user:pass@host:port"
                  class="w-full px-4 py-3 border rounded-2xl text-base"
                />
              </div>
            </div>
          </div>

          <div class="h-20"></div>
        </form>

        <!-- شريط إجراءات -->
        <div
          class="sticky bottom-0 inset-x-0 bg-white/85 backdrop-blur border-t px-6 py-3 flex flex-wrap items-center gap-2"
        >
          <span
            class="text-sm me-auto"
            :class="busy ? 'text-amber-600' : 'text-slate-500'"
          >
            {{ busy ? "جارٍ المعالجة…" : statusText }}
          </span>
          <button
            class="px-4 py-2 rounded-xl border bg-white"
            @click="connect"
            :disabled="busy"
          >
            🧩 اتصال الآن
          </button>
          <button
            class="px-4 py-2 rounded-xl border bg-white"
            @click="reset"
            :disabled="busy"
          >
            ↺ إعادة ضبط
          </button>
          <button
            class="px-4 py-2 rounded-2xl border bg-black text-white"
            @click="saveThenConnect"
            :disabled="busy"
          >
            💾 حفظ + اتصال
          </button>
        </div>
      </section>

      <!-- جانب -->
      <aside class="bg-white rounded-2xl shadow border h-fit sticky top-6">
        <div class="p-6 space-y-5">
          <h3 class="text-lg font-semibold">ملاحظات</h3>
          <ul class="list-disc ms-5 text-slate-700 space-y-1 text-sm">
            <li>الاتصال دائمًا على Mainnet (لا يوجد Testnet هنا).</li>
            <li>
              Spot Mainnet: <code>https://api.binance.com</code> |
              <code>api.binance.us</code>
            </li>
            <li>
              Futures Mainnet (USDT-M): <code>https://fapi.binance.com</code>
            </li>
            <li>
              لا تحفظ الأسرار في LocalStorage للإنتاج؛ استخدم تخزينًا مشفّرًا.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, watch, computed } from "vue";

const busy = ref(false);
const notice = ref(null);
const statusText = ref("جاهز");
const showSecret = ref(false);

/* ===== نموذج البيانات ===== */
const form = reactive({
  apiKey: "",
  apiSecret: "",
  domain: "binance.com", // binance.com | binance.us
  mode: "spot", // spot | futures (USDT-M)
  recvWindow: 5000,
  proxy: "",
});

/* تذكّر المفاتيح محليًا (واجهة فقط) */
const rememberKeys = ref(localStorage.getItem("binance.rememberKeys") !== "0");

/* Mainnet فقط */
const baseUrl = computed(() => {
  if (form.domain === "binance.us") return "https://api.binance.us";
  return form.mode === "futures"
    ? "https://fapi.binance.com"
    : "https://api.binance.com";
});

/* ======= IP state ======= */
const publicIP = ref("");
const ipBusy = ref(false);

/* أرصدة */
const balances = ref([]);

/* نظرة عامة من الخلفية */
const overview = reactive({ label: "", id: "", balances: [] });

/* تنسيق أرقام */
function formatNum(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return String(v ?? 0);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(n);
}

/* بطاقة USDT الصغيرة */
const usdtRow = computed(() => {
  const arr =
    Array.isArray(overview.balances) && overview.balances.length
      ? overview.balances
      : Array.isArray(balances.value)
      ? balances.value
      : [];
  return arr.find((b) => b.asset === "USDT") || null;
});
const usdtFree = computed(() => Number(usdtRow.value?.free || 0));
const usdtHold = computed(() =>
  Number(usdtRow.value?.locked ?? usdtRow.value?.crossWallet ?? 0)
);
const usdtTotal = computed(() => usdtFree.value + usdtHold.value);

/* عرض اسم/معرّف الحساب (اسم عرض افتراضي) */
const accountLabel = computed(
  () =>
    overview.label ||
    `${form.domain} • ${String(form.mode || "").toUpperCase()}`
);
const accountId = computed(
  () => overview.id || (form.apiKey ? `…${String(form.apiKey).slice(-6)}` : "—")
);

/* تحميل الأرصدة فقط (اختياري) */
async function loadBalances() {
  if (!window.binance?.balances) return;
  const r = await window.binance.balances();
  if (r?.ok) {
    balances.value = r.balances || [];
  } else {
    alert("فشل قراءة الرصيد: " + (r?.error || ""));
  }
}

/* نظرة عامة: تُعبّي label/id/balances وتزامن balances ref */
async function reloadOverview() {
  if (!window.binance?.overview) return;
  try {
    const r = await window.binance.overview();
    if (r?.ok) {
      overview.label = r.account?.label || "";
      overview.id = r.account?.id || "";
      overview.balances = Array.isArray(r.balances) ? r.balances : [];
      balances.value = overview.balances.slice(); // مزامنة جدول/حسابات
    } else {
      setNotice(false, "فشل قراءة الرصيد: " + (r?.error || ""));
    }
  } catch (e) {
    setNotice(false, "خطأ قراءة الرصيد: " + String(e));
  }
}

/* ===== Helpers ===== */
function setNotice(ok, msg) {
  notice.value = { ok, msg };
  if (ok)
    setTimeout(() => {
      if (notice.value?.ok) notice.value = null;
    }, 4000);
}

function validate() {
  if (!form.apiKey || form.apiKey.length < 20) return "API Key غير صحيح";
  if (!form.apiSecret || form.apiSecret.length < 20)
    return "API Secret غير صحيح";
  if (form.domain === "binance.us" && form.mode === "futures")
    return "Futures غير مدعومة على binance.us";
  return null;
}

/* === كاش محلي للمفاتيح (واجهة فقط) === */
const FRONT_CACHE_KEY = "binance.cachedKeys.v1";
function saveFrontKeys() {
  localStorage.setItem("binance.rememberKeys", rememberKeys.value ? "1" : "0");
  if (!rememberKeys.value) {
    localStorage.removeItem(FRONT_CACHE_KEY);
    return;
  }
  try {
    const blob = btoa(
      JSON.stringify({ apiKey: form.apiKey, apiSecret: form.apiSecret })
    );
    localStorage.setItem(FRONT_CACHE_KEY, blob);
  } catch {}
}
function loadFrontKeys() {
  try {
    if (localStorage.getItem("binance.rememberKeys") === "0") {
      rememberKeys.value = false;
      return;
    }
    const raw = localStorage.getItem(FRONT_CACHE_KEY);
    if (!raw) return;
    const { apiKey, apiSecret } = JSON.parse(atob(raw));
    if (apiKey) form.apiKey = apiKey;
    if (apiSecret) form.apiSecret = apiSecret;
  } catch {}
}
function clearFrontKeys() {
  localStorage.removeItem(FRONT_CACHE_KEY);
}

/* === حفظ/تحميل إلى الخلفية === */
async function save({ silent = false } = {}) {
  const err = validate();
  if (err) {
    setNotice(false, err);
    return false;
  }
  busy.value = true;
  try {
    if (window.binance?.save) {
      await window.binance.save({ ...form, baseUrl: baseUrl.value });
      saveFrontKeys();
      if (!silent) setNotice(true, "تم الحفظ (خلفية).");
      statusText.value = "تم الحفظ";
    } else {
      localStorage.setItem(
        "binance.settings.v2.mainnet",
        JSON.stringify({ ...form })
      );
      saveFrontKeys();
      if (!silent) setNotice(true, "تم الحفظ محليًا.");
      statusText.value = "تم الحفظ محليًا";
    }
    return true;
  } catch (e) {
    setNotice(false, "فشل الحفظ: " + String(e));
    return false;
  } finally {
    busy.value = false;
  }
}

async function loadSettings() {
  try {
    if (window.binance?.load) {
      const cfg = await window.binance.load();
      if (cfg && typeof cfg === "object")
        Object.assign(form, { ...form, ...cfg, apiSecret: "" }); // السر لا يعود
      statusText.value = "تم التحميل من الخلفية";
    } else {
      const raw = localStorage.getItem("binance.settings.v2.mainnet");
      if (raw) {
        const cfg = JSON.parse(raw);
        Object.assign(form, cfg);
        statusText.value = "تم التحميل محليًا";
      }
    }
    loadFrontKeys();
  } catch {}
}

/* === اتصال === */
async function connect() {
  const err = validate();
  if (err) {
    setNotice(false, err);
    return;
  }
  busy.value = true;
  statusText.value = "الاتصال…";
  try {
    if (window.binance?.test) {
      const res = await window.binance.test({
        ...form,
        baseUrl: baseUrl.value,
      });
      if (res?.ok) {
        setNotice(true, "اتصال ناجح ✅");
        await reloadOverview(); // تحديث اسم/معرّف/أرصدة
      } else {
        setNotice(
          false,
          "الاتصال فشل: " + (res?.error || "تحقق من المفاتيح/الصلاحيات")
        );
      }
    } else {
      setNotice(
        false,
        "لا يوجد معالج خلفي للاتصال. أضف binance.test في preload/main."
      );
    }
  } catch (e) {
    setNotice(false, "الاتصال فشل: " + String(e));
  } finally {
    busy.value = false;
    statusText.value = "جاهز";
  }
}

async function saveThenConnect() {
  const ok = await save({ silent: true });
  if (ok) {
    await connect();
    await reloadOverview();
  }
}

function reset() {
  Object.assign(form, {
    apiKey: "",
    apiSecret: "",
    domain: "binance.com",
    mode: "spot",
    recvWindow: 5000,
    proxy: "",
  });
  clearFrontKeys();
  setNotice(true, "تمت إعادة الضبط.");
}

/* ======= IP: refresh + copy ======= */
async function refreshIP() {
  ipBusy.value = true;
  publicIP.value = "";
  try {
    if (window.net?.publicIP) {
      const r = await window.net.publicIP(form.proxy || "");
      if (r?.ok && r.ip) {
        publicIP.value = r.ip;
        return;
      }
    }
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
          return;
        }
      } catch {}
    }
    setNotice(false, "تعذّر جلب IP — تحقّق من الاتصال/البروكسي.");
  } catch (e) {
    setNotice(false, "IP error: " + String(e));
  } finally {
    ipBusy.value = false;
  }
}

async function copyIP() {
  try {
    if (!publicIP.value) await refreshIP();
    if (!publicIP.value) return setNotice(false, "لا يوجد IP متاح");
    await navigator.clipboard.writeText(publicIP.value);
    setNotice(true, "تم نسخ IP: " + publicIP.value);
  } catch (e) {
    setNotice(false, "تعذّر نسخ IP: " + String(e));
  }
}

/* حفظ تلقائي خفيف */
let t = null;
watch(
  form,
  () => {
    clearTimeout(t);
    t = setTimeout(() => {
      save({ silent: true });
    }, 700);
  },
  { deep: true }
);

onMounted(async () => {
  await loadSettings();
  await refreshIP();
  await reloadOverview(); // يُظهر USDT والهوية فورًا إن كان مخزّنًا
});
</script>
