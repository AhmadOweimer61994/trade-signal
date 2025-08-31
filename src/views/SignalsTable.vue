<template>
  <div
    class="min-h-screen p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-200"
  >
    <!-- Popup: دخول الصفقة -->
    <!-- Popup: دخول الصفقة -->
    <div
      v-if="enterDlg.open"
      class="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        @click="closeEnter()"
      ></div>

      <div
        class="relative w-full max-w-md mx-3 rounded-2xl border border-white/10 bg-slate-900 text-slate-100 shadow-xl"
      >
        <div
          class="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center gap-2"
        >
          <div
            class="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.4)]"
          ></div>
          <div class="font-semibold">دخول الصفقة — {{ enterDlg.symbol }}</div>
          <div class="ms-auto text-xs text-slate-400">{{ enterDlg.side }}</div>
        </div>

        <div class="p-4 space-y-4">
          <div class="text-xs text-slate-400">
            Entry:
            <b class="text-slate-200"
              >{{ enterDlg.entry_from }}–{{ enterDlg.entry_to }}</b
            >
            • SL: <b class="text-rose-300">{{ enterDlg.sl }}</b>
          </div>

          <!-- اختيار الهدف (حتى 6) -->
          <div>
            <div class="text-sm mb-1">اختر الهدف</div>
            <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
              <button
                v-for="opt in targetOpts"
                :key="opt.key"
                @click="enterDlg.targetKey = opt.key"
                :class="[
                  'px-2.5 py-2 rounded-xl border text-sm text-center',
                  enterDlg.targetKey === opt.key
                    ? 'border-amber-400/40 bg-amber-400/15 text-amber-200'
                    : 'border-white/10 bg-white/5 hover:bg-white/10',
                ]"
              >
                <div class="font-medium">{{ opt.label }}</div>
                <div class="text-[11px] text-slate-300">{{ opt.value }}</div>
              </button>
            </div>
          </div>

          <!-- مبلغ الدخول (أزرار سريعة + +/- + سلايدر) -->
          <div>
            <label class="text-sm mb-1 block">المبلغ (USDT)</label>

            <div class="flex items-stretch gap-2">
              <button
                type="button"
                class="px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
                @click="nudgeUsdt(-5)"
              >
                −5
              </button>

              <input
                v-model.number="enterDlg.usdt"
                type="number"
                inputmode="decimal"
                min="5"
                step="0.5"
                class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                placeholder="مثال: 10"
              />

              <button
                type="button"
                class="px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
                @click="nudgeUsdt(5)"
              >
                +5
              </button>
            </div>

            <!-- سلايدر + شرائح سريعة -->
            <div class="mt-2">
              <input
                type="range"
                :min="5"
                :max="Math.max(5, Math.floor(usdtFree) || 100)"
                step="0.5"
                :value="enterDlg.usdt || 5"
                @input="enterDlg.usdt = Number($event.target.value)"
                class="w-full"
              />
            </div>

            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="v in [10, 25, 50, 100]"
                :key="v"
                type="button"
                class="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                @click="enterDlg.usdt = v"
              >
                {{ v }}$
              </button>

              <button
                v-if="usdtFree > 0"
                type="button"
                class="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-400/10 hover:bg-emerald-400/15 text-emerald-200 text-sm"
                @click="enterDlg.usdt = Math.max(5, Math.floor(usdtFree / 2))"
              >
                50% من رصيدك (≈ {{ Math.floor(usdtFree / 2) }}$)
              </button>
            </div>

            <div class="text-[11px] text-slate-400 mt-1">
              تقدير الكمية ≈ {{ estQty }}
            </div>
          </div>
        </div>

        <div
          class="px-4 py-3 border-t border-white/10 bg-white/5 flex items-center gap-2"
        >
          <button
            @click="confirmEnter"
            :disabled="enterBusy"
            class="px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-medium hover:bg-emerald-400 disabled:opacity-60"
          >
            ✅ دخول
          </button>
          <button
            @click="closeEnter"
            :disabled="enterBusy"
            class="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
          >
            إلغاء
          </button>
          <span v-if="enterBusy" class="ms-auto text-xs text-slate-400"
            >جارٍ التنفيذ…</span
          >
        </div>
      </div>
    </div>

    <!-- بانر قيود الأهلية من بايننس -->
    <div
      v-if="lastError && /Eligibility|restricted location/i.test(lastError)"
      class="mx-2 sm:mx-6 mt-2 p-3 rounded-xl border bg-amber-400/10 border-amber-300/20 text-amber-200"
    >
      تم رفض الطلب بسبب القيود الجغرافية. إن كنت داخل الولايات المتحدة اضغط:
      <button
        type="button"
        class="ml-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        @click="quickSwitchToUS"
        :disabled="busy"
      >
        التحويل إلى Binance.US + Spot وإعادة الاتصال
      </button>
    </div>

    <!-- أزرار التحكم والحالة -->
    <div class="mb-4 mt-2 flex flex-wrap items-center gap-2">
      <button
        @click="start"
        :disabled="!hasElectron || busy"
        class="px-3 py-1.5 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      >
        ▶️ Start
      </button>
      <button
        @click="stop"
        :disabled="!hasElectron"
        class="px-3 py-1.5 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
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

    <!-- شريط Binance/IP الذهبي + مفاتيح تبديل سريعة -->
    <div
      class="mb-5 p-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-slate-400">Endpoint:</span>
        <span
          class="text-xs px-2 py-1 rounded bg-amber-400/10 text-amber-200 border border-amber-300/20"
        >
          {{ binance.domain || "—" }} •
          {{ (binance.mode || "").toUpperCase() || "—" }}
        </span>

        <span class="mx-2 h-4 w-px bg-white/10"></span>

        <span class="text-xs text-slate-400">IP:</span>
        <b class="text-xs">{{ publicIP || "—" }}</b>
        <button
          type="button"
          class="px-2 py-1 rounded-lg border border-white/10 bg-white/10 hover:bg-white/15 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          @click="refreshIP"
        >
          🔁 تحديث IP
        </button>
        <button
          type="button"
          class="px-2 py-1 rounded-lg border border-white/10 bg-white/10 hover:bg-white/15 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          @click="copyMyIP"
        >
          📋 نسخ
        </button>

        <span class="mx-2 h-4 w-px bg-white/10"></span>

        <div class="flex items-center gap-1">
          <button
            class="px-2 py-1 rounded-lg border border-emerald-500/20 bg-emerald-400/10 hover:bg-emerald-400/15 text-emerald-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            @click="switchTo('binance.com', 'spot')"
            :disabled="busy"
            title="binance.com • Spot"
          >
            binance.com • Spot
          </button>
          <button
            class="px-2 py-1 rounded-lg border border-emerald-500/20 bg-emerald-400/10 hover:bg-emerald-400/15 text-emerald-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            @click="switchTo('binance.com', 'futures')"
            :disabled="busy"
            title="binance.com • Futures (USDT-M)"
          >
            binance.com • Futures
          </button>
          <button
            class="px-2 py-1 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/15 text-amber-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            @click="switchTo('binance.us', 'spot')"
            :disabled="busy"
            title="binance.us • Spot"
          >
            binance.us • Spot
          </button>
        </div>

        <span class="ms-auto text-xs text-slate-400">{{
          binanceStatus || ""
        }}</span>
      </div>
    </div>

    <!-- إدخال اسم القناة/اليوزر + أزرار التحكم -->
    <div class="mb-5 flex flex-wrap items-center gap-2">
      <input
        v-model="targetInput"
        @keydown.enter.prevent="listen"
        :disabled="!hasElectron"
        placeholder="اكتب اسم القناة أو @username (مثال: my_signals_channel)"
        class="px-3 py-2 border rounded-xl min-w-[320px] bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      />
      <button
        @click="listen"
        :disabled="!hasElectron || !targetInput.trim()"
        class="px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      >
        📡 استمع
      </button>
      <button
        @click="refreshTargets"
        :disabled="!hasElectron"
        class="px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      >
        🔄 تحديث الأهداف
      </button>
      <span class="text-xs text-slate-400"
        >الأهداف الحالية:
        <b class="text-slate-200">{{ targets.join(", ") || "—" }}</b></span
      >
    </div>

    <!-- فورم تسجيل الدخول التفاعلي (كود/2FA) -->
    <div
      v-if="login.needCode || login.needPassword"
      class="mb-5 p-4 border rounded-xl bg-white/5 border-white/10 backdrop-blur"
    >
      <div class="font-medium mb-1 text-slate-100">
        تسجيل الدخول مطلوب للحساب:
        <span class="font-mono text-slate-300">{{
          login.phone || "(غير معروف)"
        }}</span>
      </div>
      <p v-if="login.msg" class="text-xs text-amber-300/90 mb-2">
        {{ login.msg }}
      </p>

      <div v-if="login.needCode" class="flex items-center gap-2 mb-2">
        <input
          v-model="login.code"
          @keydown.enter.prevent="submitCode"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="أدخل كود التفعيل (5/6 أرقام)"
          class="px-3 py-1.5 border rounded bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
        <button
          @click="submitCode"
          class="px-3 py-1.5 rounded border border-white/10 bg-white/10 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        >
          إرسال الكود
        </button>
      </div>

      <div v-if="login.needPassword" class="flex items-center gap-2">
        <input
          v-model="login.password"
          @keydown.enter.prevent="submitPassword"
          type="password"
          placeholder="أدخل كلمة مرور 2FA"
          class="px-3 py-1.5 border rounded bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        />
        <button
          @click="submitPassword"
          class="px-3 py-1.5 rounded border border-white/10 bg-white/10 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        >
          إرسال كلمة المرور
        </button>
      </div>

      <div class="text-xs text-slate-400 mt-2">
        * سيتم استخدام القيم لمرة واحدة لتوليد جلسة محلية آمنة.
      </div>
    </div>

    <!-- بطاقات الإشارات -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="r in rows"
        :key="r._key"
        class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-sm overflow-hidden ring-1 ring-white/10 hover:ring-amber-400/30 transition"
      >
        <!-- شريط ذهبي رفيع أعلى الكرت -->
        <div
          class="h-0.5 w-full bg-gradient-to-r from-amber-400/60 via-amber-300/30 to-transparent"
        ></div>

        <!-- رأس الكرت -->
        <div
          class="px-3 py-2 border-b border-white/10 bg-white/5 flex items-center justify-between shadow-[0_1px_0_0_rgba(251,191,36,0.15)]"
        >
          <div class="font-medium truncate text-slate-100">
            {{ r.peer || "Signal" }}
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">{{ r.timeframe || "-" }}</span>
            <span :class="badgeClass(r.side)">{{ r.side }}</span>
          </div>
        </div>

        <!-- محتوى -->
        <div class="p-3 space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <div class="font-semibold text-slate-100">
              {{ r.pair || r.symbol }}
            </div>
            <div class="text-xs text-slate-400">{{ niceTime(r.date_iso) }}</div>
          </div>

          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-xs text-slate-400">Entry</div>
            <div class="text-right text-slate-200">
              {{ r.entry_from }} – {{ r.entry_to }}
            </div>

            <div class="text-xs text-slate-400">TP1</div>
            <div class="text-right text-slate-200">{{ r.tp1 }}</div>

            <div class="text-xs text-slate-400">TP2</div>
            <div class="text-right text-slate-200">{{ r.tp2 }}</div>

            <div class="text-xs text-slate-400">TP3</div>
            <div class="text-right text-slate-200">{{ r.tp3 }}</div>
            <div class="text-xs text-slate-400">TP4</div>
            <div class="text-right text-slate-200">{{ r.tp4 }}</div>
            <div class="text-xs text-slate-400">TP5</div>
            <div class="text-right text-slate-200">{{ r.tp5 }}</div>
            <div class="text-xs text-slate-400">TP6</div>
            <div class="text-right text-slate-200">{{ r.tp6 }}</div>

            <div class="text-xs text-slate-400">SL</div>
            <div class="text-right text-rose-300">{{ r.sl }}</div>

            <div class="text-xs text-slate-400">Vol</div>
            <div class="text-right text-slate-200">
              {{ formatNum(r.volume) }}
            </div>

            <div class="text-xs text-slate-400">Msg#</div>
            <div class="text-right text-slate-300">{{ r.message_id }}</div>
          </div>
        </div>

        <!-- أزرار الإجراءات -->
        <div
          class="px-3 py-2 border-t border-white/10 bg-white/5 flex items-center gap-2"
        >
          <button
            class="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-400/10 hover:bg-emerald-400/15 text-emerald-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            :disabled="rowBusy[r._key]"
            @click="openEnter(r)"
            title="تنفيذ الصفقة"
          >
            ✅ دخول الصفقة
          </button>
          <button
            class="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-400/10 hover:bg-rose-400/15 text-rose-200 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            :disabled="rowBusy[r._key]"
            @click="doDelete(r)"
            title="حذف رسالة الإشارة من المصدر"
          >
            🗑️ حذف
          </button>
          <span class="ml-auto text-xs text-slate-400" v-if="rowBusy[r._key]"
            >جارٍ…</span
          >
        </div>
      </div>
    </div>

    <!-- لوج داخلي -->
    <details class="mt-4 text-xs text-slate-400">
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

/* حالة انشغال لكل كرت */
const rowBusy = reactive({});

/* Binance state + IP */
const binance = reactive({ domain: "", mode: "", proxy: "" });
const binanceStatus = ref("");
const publicIP = ref("");

/* أخطاء / رصيد */
const lastError = ref("");
const usdtFree = ref(0);

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

/* ===== Helpers عامة ===== */
function niceTime(iso) {
  try {
    return new Date(iso).toISOString().replace("T", " ").replace("Z", "");
  } catch {
    return iso;
  }
}

async function loadUSDTFree() {
  try {
    const r = await window.binance?.overview?.();
    if (r?.ok && Array.isArray(r.balances)) {
      const usdt = r.balances.find((b) => b.asset === "USDT");
      usdtFree.value = Number(usdt?.free || 0);
    }
  } catch {}
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
  const base = "px-2 py-0.5 rounded-full text-[11px] border";
  return side === "BUY"
    ? base + " bg-emerald-400/10 text-emerald-300 border-emerald-500/20"
    : base + " bg-rose-400/10 text-rose-300 border-rose-500/20";
}

function pushRow(r) {
  const key = `${r.message_id}|${r.date_iso}|${r.peer || ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  r._key = key;
  rows.value.unshift(r);
  if (rows.value.length > 1000) rows.value.pop();
}

/* ===== مودال الدخول ===== */
const enterDlg = reactive({
  open: false,
  row: null,
  symbol: "",
  side: "",
  entry_from: "",
  entry_to: "",
  sl: "",
  targetKey: "tp1",
  usdt: 10,
  price: NaN, // سعر السوق الحالي (Spot)
  mode: "spot", // ثابت Spot
  info: null, // exchangeInfo (stepSize/tickSize/minNotional)
});
const enterBusy = ref(false);

/* كل الأهداف حتى TP6 */
const targetOpts = computed(() => {
  if (!enterDlg.row) return [];
  const r = enterDlg.row;
  const keys = ["tp1", "tp2", "tp3", "tp4", "tp5", "tp6"];
  return keys
    .map((k, i) => ({ key: k, label: "TP" + (i + 1), value: r?.[k] }))
    .filter((o) => o.value != null && String(o.value).trim() !== "");
});

const chosenTP = computed(() => {
  const k = enterDlg.targetKey;
  return k && enterDlg.row ? Number(enterDlg.row[k]) : NaN;
});

/* تقدير الكمية: المبلغ / (سعر السوق أو متوسط نطاق الدخول) ثم تقليم بالـ stepSize */
function decs(stepStr = "0.00000001") {
  const s = String(stepStr);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}
function fixByStep(x, stepStr) {
  const d = decs(stepStr);
  const m = Math.pow(10, d);
  return Math.floor(Number(x) * m) / m;
}
function roundByTick(x, tickStr) {
  const d = decs(tickStr);
  return Number(x).toFixed(d);
}

const estQty = computed(() => {
  const a = Number(enterDlg.entry_from || 0);
  const b = Number(enterDlg.entry_to || 0);
  const mid = a && b ? (a + b) / 2 : a || b || 0;
  const price =
    Number.isFinite(enterDlg.price) && enterDlg.price > 0
      ? enterDlg.price
      : mid;
  if (!price) return "—";
  const info = enterDlg.info || {};
  const stepSize = info.stepSize || "0.00000001";
  const q = fixByStep(Number(enterDlg.usdt || 0) / price, stepSize);
  return q > 0 ? q.toFixed(Math.min(8, decs(stepSize))) : "—";
});

function toSymbol(raw) {
  const s = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return /USDT$/.test(s) ? s : s + "USDT";
}

/* افتح المودال */
async function openEnter(r) {
  try {
    enterDlg.row = r;
    enterDlg.open = true;
    enterDlg.side = String(r.side || "").toUpperCase();
    enterDlg.entry_from = r.entry_from;
    enterDlg.entry_to = r.entry_to;
    enterDlg.sl = r.sl || "";
    enterDlg.usdt = Number(r.volume) || 10;
    enterDlg.mode = "spot"; // نحصر Spot فقط

    const raw = r.pair || r.symbol;
    enterDlg.symbol = toSymbol(raw);

    // سعر السوق
    const p = await window.binance?.price?.(enterDlg.symbol);
    if (p?.ok) enterDlg.price = Number(p.price);

    // معلومات الرمز
    const ex = await window.binance?.exchangeInfo?.(enterDlg.symbol);
    if (ex?.ok) enterDlg.info = ex.info;

    // أول هدف متاح
    const opts = targetOpts.value;
    enterDlg.targetKey = (opts[0] && opts[0].key) || "tp1";

    // رصيد USDT (للسلايدر والاختصارات)
    await loadUSDTFree();
  } catch (e) {
    alert("خطأ فتح النافذة: " + String(e));
  }
}
function closeEnter() {
  if (enterBusy.value) return;
  enterDlg.open = false;
  enterDlg.row = null;
}

/* تنفيذ فعلي (Spot فقط) */
async function confirmEnter() {
  if (!enterDlg.open || !enterDlg.row) return;
  enterBusy.value = true;

  try {
    if (!window.binance?.order)
      throw new Error("واجهة بايننس غير متاحة في الواجهة.");

    const symbol = enterDlg.symbol;
    const side = enterDlg.side; // BUY / SELL
    const priceNow =
      Number.isFinite(enterDlg.price) && enterDlg.price > 0
        ? Number(enterDlg.price)
        : Number(enterDlg.entry_from || enterDlg.entry_to);

    const tp = Number(chosenTP.value);
    const sl = Number(enterDlg.sl);
    const usdt = Number(enterDlg.usdt);

    if (
      !Number.isFinite(tp) ||
      !Number.isFinite(sl) ||
      !Number.isFinite(usdt) ||
      usdt <= 0
    ) {
      throw new Error("الرجاء التحقق من الهدف/الوقف/المبلغ");
    }
    if (!priceNow) throw new Error("تعذّر جلب السعر الحالي");

    const info = enterDlg.info || {};
    const stepSize = info.stepSize || "0.00000001";
    const tickSize = info.tickSize || "0.00000001";
    const minNotional = Number(info.minNotional || 0);
    const minQty = Number(info.minQty || 0);

    // تحقّق NOTIONAL قبل الإرسال
    if (minNotional && usdt < minNotional) {
      throw new Error(
        `قيمة الصفقة أقل من الحد الأدنى: ${minNotional} USDT (NOTIONAL)`
      );
    }

    // احسب كمية تقريبية للعرض فقط؛ تنفيذ BUY بالـ quoteOrderQty
    let qty = fixByStep(usdt / priceNow, stepSize);
    if (minQty && qty < minQty) {
      // لو الكمية أصغر من المسموح، نحاول رفعها إلى minQty (مع تحذير)
      qty = fixByStep(minQty, stepSize);
    }
    if (qty <= 0) throw new Error("الكمية المحسوبة تساوي صفر بعد التقريب");

    if (side === "BUY") {
      // 1) شراء MARKET بقيمة USDT
      const buy = await window.binance.order({
        symbol,
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: usdt,
      });
      if (!buy?.ok) throw new Error(buy?.error || "فشل شراء Spot");

      const exQty = Number(buy.order?.executedQty || qty);
      const sellQty = fixByStep(exQty, stepSize);
      if (sellQty <= 0) throw new Error("لا توجد كمية منفذة للبيع");

      // 2) OCO SELL: هدف + وقف
      const oco = await window.binance.oco({
        symbol,
        quantity: String(sellQty),
        price: roundByTick(tp, tickSize),
        stopPrice: roundByTick(sl, tickSize),
        stopLimitPrice: roundByTick(sl * 0.998, tickSize),
        stopLimitTimeInForce: "GTC",
      });
      if (!oco?.ok) throw new Error(oco?.error || "فشل إنشاء OCO");
    } else {
      // SELL Spot: بيع MARKET من المتاح
      const sell = await window.binance.order({
        symbol,
        side: "SELL",
        type: "MARKET",
        quantity: String(qty),
      });
      if (!sell?.ok) throw new Error(sell?.error || "فشل بيع Spot");
      // ملاحظة: OCO BUY غير مدعوم في Spot
    }

    alert("تم تنفيذ الصفقة ووضع الهدف/الوقف ✅");
    closeEnter();
  } catch (e) {
    alert(String(e));
  } finally {
    enterBusy.value = false;
  }
}

/* لفتح المودال من الكرت */
function doEnter(r) {
  openEnter(r);
}

/* حذف رسالة الإشارة من المصدر (لو موجود بالتيمبلت) */
async function doDelete(r) {
  if (!hasElectron) return;
  const fn = window.signals?.deleteMessage || window.signals?.delete;
  if (!fn) {
    alert("delete IPC غير متاح");
    return;
  }
  try {
    rowBusy[r._key] = true;
    await fn(r.message_id);
    rows.value = rows.value.filter((x) => x._key !== r._key);
    metaLog.value.push(`delete ok: ${r.message_id}`);
  } catch (e) {
    metaLog.value.push(`delete error: ${String(e)}`);
    alert("فشل حذف الرسالة: " + String(e));
  } finally {
    rowBusy[r._key] = false;
  }
}

/* ===== إشارات تيليجرام + لوج ===== */
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

/* ===== Binance cfg/IP ===== */
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

async function refreshIP() {
  try {
    publicIP.value = "";
    if (window.net?.publicIP) {
      const r = await window.net.publicIP(binance.proxy || "");
      if (r?.ok && r.ip) {
        publicIP.value = r.ip;
        metaLog.value.push("Public IP (backend): " + r.ip);
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

/* تبديل سريع */
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
async function quickSwitchToUS() {
  await switchTo("binance.us", "spot");
}

/* تحكم إشارات */
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
async function refreshTargets() {
  if (!hasElectron) return;
  try {
    await window.signals.listTargets();
  } catch {}
}
function clearSignals() {
  rows.value = [];
  seen.clear();
}

/* mount */
onMounted(async () => {
  if (hasElectron) {
    window.signals.onNew(onNew);
    window.signals.onMeta(onMeta);
    start();
    refreshTargets();
    await loadBinanceCfg();
  }
  await refreshIP();
  await loadUSDTFree();
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

/* ألوان حالة التشغيل */
const statusClass = computed(() =>
  status.value.includes("listening") ||
  status.value.includes("started") ||
  status.value.includes("already_authorized")
    ? "text-emerald-300"
    : status.value.includes("starting") || status.value.includes("awaiting")
    ? "text-amber-300"
    : status.value.includes("error")
    ? "text-rose-300"
    : "text-slate-400"
);

/* نصدّر الدوال المستخدمة في التمبلِت لو احتجتها هناك */
</script>
