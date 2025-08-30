<template>
  <div class="min-h-screen p-6">
    <div class="mx-auto w-full max-w-6xl grid gap-6 xl:grid-cols-[2fr_1fr]">
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
                    {{ showSecret ? 'إخفاء' : 'إظهار' }}
                  </button>
                </div>
                <p class="text-xs text-slate-500 mt-1">
                  يفضّل حفظ السر مشفّرًا من الخلفية.
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
            {{ busy ? 'جارٍ المعالجة…' : statusText }}
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
import { reactive, ref, onMounted, watch, computed } from 'vue';

const busy = ref(false);
const notice = ref(null);
const statusText = ref('جاهز');
const showSecret = ref(false);

const form = reactive({
  apiKey: '',
  apiSecret: '',
  domain: 'binance.com', // binance.com | binance.us
  mode: 'spot', // spot | futures (USDT-M)
  recvWindow: 5000,
  proxy: '',
});

/* Mainnet فقط */
const baseUrl = computed(() => {
  if (form.domain === 'binance.us') return 'https://api.binance.us';
  return form.mode === 'futures'
    ? 'https://fapi.binance.com'
    : 'https://api.binance.com';
});

function setNotice(ok, msg) {
  notice.value = { ok, msg };
  if (ok)
    setTimeout(() => {
      if (notice.value?.ok) notice.value = null;
    }, 4000);
}

function validate() {
  if (!form.apiKey || form.apiKey.length < 20) return 'API Key غير صحيح';
  if (!form.apiSecret || form.apiSecret.length < 20)
    return 'API Secret غير صحيح';
  if (form.domain === 'binance.us' && form.mode === 'futures')
    return 'Futures غير مدعومة على binance.us';
  return null;
}

function storageKey() {
  return 'binance.settings.v2.mainnet';
}

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
      if (!silent) setNotice(true, 'تم الحفظ (خلفية).');
      statusText.value = 'تم الحفظ';
    } else {
      localStorage.setItem(storageKey(), JSON.stringify({ ...form }));
      if (!silent) setNotice(true, 'تم الحفظ محليًا.');
      statusText.value = 'تم الحفظ محليًا';
    }
    return true;
  } catch (e) {
    setNotice(false, 'فشل الحفظ: ' + String(e));
    return false;
  } finally {
    busy.value = false;
  }
}

async function loadSettings() {
  try {
    if (window.binance?.load) {
      const cfg = await window.binance.load();
      if (cfg && typeof cfg === 'object') Object.assign(form, cfg);
      statusText.value = 'تم التحميل من الخلفية';
    } else {
      const raw = localStorage.getItem(storageKey());
      if (raw) {
        const cfg = JSON.parse(raw);
        Object.assign(form, cfg);
        statusText.value = 'تم التحميل محليًا';
      }
    }
  } catch {}
}

async function connect() {
  const err = validate();
  if (err) {
    setNotice(false, err);
    return;
  }
  busy.value = true;
  statusText.value = 'الاتصال…';
  try {
    // استخدم test كـ "اتصال" إن واجهتك الخلفية (main) مبنية عليه
    if (window.binance?.test) {
      const res = await window.binance.test({
        ...form,
        baseUrl: baseUrl.value,
      });
      if (res?.ok) setNotice(true, 'اتصال ناجح ✅');
      else
        setNotice(
          false,
          'الاتصال فشل: ' + (res?.error || 'تحقق من المفاتيح/الصلاحيات')
        );
    } else {
      setNotice(
        false,
        'لا يوجد معالج خلفي للاتصال. أضف binance.test في preload/main.'
      );
    }
  } catch (e) {
    setNotice(false, 'الاتصال فشل: ' + String(e));
  } finally {
    busy.value = false;
    statusText.value = 'جاهز';
  }
}

async function saveThenConnect() {
  const ok = await save({ silent: true });
  if (ok) await connect();
}

function reset() {
  Object.assign(form, {
    apiKey: '',
    apiSecret: '',
    domain: 'binance.com',
    mode: 'spot',
    recvWindow: 5000,
    proxy: '',
  });
  setNotice(true, 'تمت إعادة الضبط.');
}

/* حفظ تلقائي خفيف (بدون Testnet) */
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

onMounted(loadSettings);
</script>
