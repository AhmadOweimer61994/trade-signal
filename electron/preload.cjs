// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

/* ------------ Event bus helper (مع تنظيف تلقائي) ------------ */
function makeOn(channel) {
  const listeners = new Set();
  const handler = (_e, payload) => {
    for (const cb of listeners) {
      try {
        cb(payload);
      } catch {}
    }
  };
  ipcRenderer.on(channel, handler);

  const cleanup = () => {
    try {
      ipcRenderer.removeListener(channel, handler);
    } catch {}
    listeners.clear();
  };
  if (typeof window !== "undefined") {
    window.addEventListener?.("beforeunload", cleanup);
  }

  return {
    on(cb) {
      listeners.add(cb);
    },
    off(cb) {
      listeners.delete(cb);
    },
    _cleanup: cleanup,
  };
}

/* ------------ قنوات أحداث تيليجرام ------------ */
const newBus = makeOn("signals:new");
const metaBus = makeOn("signals:meta");

/* ------------ Utils: استدعاء آمن مع fallback لقناة عامة ------------ */
async function _invokeOrCmd(specificChannel, specificArgs, cmdPayload) {
  try {
    return await ipcRenderer.invoke(specificChannel, ...(specificArgs || []));
  } catch {
    // رجوع لقناة عامة موحّدة لو القناة المتخصصة مش متاحة
    return await ipcRenderer.invoke("signals:cmd", cmdPayload);
  }
}

function _normalizeTargets(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => String(x ?? "").trim()).filter(Boolean);
}

/* ------------ Signals API (Telegram) ------------ */
const signalsAPI = {
  // تشغيل/إيقاف بايثون (main عنده auto-start برضه)
  start: () => ipcRenderer.invoke("signals:start"),
  stop: () => ipcRenderer.invoke("signals:stop"),

  // الاشتراك/إلغاء الاشتراك في الأحداث
  onNew: (cb) => newBus.on(cb),
  offNew: (cb) => newBus.off(cb),
  onMeta: (cb) => metaBus.on(cb),
  offMeta: (cb) => metaBus.off(cb),

  // تعيين أهداف الاستماع (قنوات/يوزرات)
  setTargets: (list) => {
    const targets = _normalizeTargets(list);
    if (!targets.length) return Promise.resolve(false);
    return _invokeOrCmd("signals:setTargets", [targets], {
      op: "set_targets",
      usernames: targets,
    });
  },

  // هدف واحد سريعًا
  setTarget: (name) => {
    const t = String(name ?? "").trim();
    if (!t) return Promise.resolve(false);
    return _invokeOrCmd("signals:setTargets", [[t]], {
      op: "set_targets",
      usernames: [t],
    });
  },

  // طلب الأهداف الحالية
  listTargets: () =>
    _invokeOrCmd("signals:listTargets", [], { op: "list_targets" }),

  // أوامر تسجيل الدخول التفاعلية
  sendCode: (code) =>
    _invokeOrCmd("signals:code", [String(code ?? "").trim()], {
      op: "code",
      code: String(code ?? "").trim(),
    }),
  sendPassword: (password) =>
    _invokeOrCmd("signals:password", [String(password ?? "")], {
      op: "password",
      password: String(password ?? ""),
    }),
  resendCode: () => ipcRenderer.invoke("signals:cmd", { op: "resend_code" }),

  // إدارة الجلسة/الخروج
  resetSession: () =>
    ipcRenderer.invoke("signals:cmd", { op: "reset_session" }),
  exitBot: () => ipcRenderer.invoke("signals:cmd", { op: "stop" }),

  // عمليات على الرسائل/السيجنال
  delete: (messageId) =>
    ipcRenderer.invoke("signals:cmd", { op: "delete", message_id: messageId }),
  deleteMessage: (messageId) =>
    ipcRenderer.invoke("signals:cmd", { op: "delete", message_id: messageId }),

  // إدخال صفقة
  enter: (signalRow) =>
    _invokeOrCmd("signals:enter", [signalRow], {
      op: "enter",
      signal: signalRow,
    }),

  // قناة عامة احتياطية
  cmd: (obj) => ipcRenderer.invoke("signals:cmd", obj),
};

/* ------------ Binance API (lowdb JSON + secret مشفّر) ------------ */
const binanceAPI = {
  save: (cfg) => ipcRenderer.invoke("binance:save", cfg), // يحفظ بالمخزن (lowdb) والسر مشفّر
  load: () => ipcRenderer.invoke("binance:load"), // يرجّع الإعدادات العامة بدون السر
  update: (patch) => ipcRenderer.invoke("binance:update", patch), // تعديل domain/mode/recvWindow/proxy
  test: (cfg) => ipcRenderer.invoke("binance:test", cfg), // اختبار اتصال موقّع
  switchToUS: () => ipcRenderer.invoke("binance:switchToUS"), // تحويل سريع إلى binance.us + spot
  overview: () => ipcRenderer.invoke("binance:overview"), // ⬅️ مهم
  balances: () => ipcRenderer.invoke("binance:balances"),
};

/* ------------ Net API (IP عمومي) ------------ */
const netAPI = {
  publicIP: (proxy) => ipcRenderer.invoke("net:publicIP", proxy || ""),
};

/* ------------ (اختياري) توافق مع واجهات قديمة: posAPI.bot ------------ */
const posAPIShim = {
  bot: {
    start: () => ipcRenderer.invoke("signals:start"),
    stop: () => ipcRenderer.invoke("signals:stop"),
    setTargets: (arr) => ipcRenderer.invoke("signals:setTargets", arr),
    listTargets: () => ipcRenderer.invoke("signals:listTargets"),
    sendCode: (code) => ipcRenderer.invoke("signals:code", code),
    sendPassword: (password) =>
      ipcRenderer.invoke("signals:password", password),
    onSig: (cb) => {
      // نبثّ كل meta كما هي، والإشارات بنوع signal
      const metaHandler = (_e, payload) => {
        try {
          cb(payload);
        } catch {}
      };
      const sigHandler = (_e, data) => {
        try {
          cb({ type: "signal", data });
        } catch {}
      };
      ipcRenderer.on("signals:meta", metaHandler);
      ipcRenderer.on("signals:new", sigHandler);
      // إرجاع دالة لإلغاء الاشتراك (للي يحتاجها)
      return () => {
        try {
          ipcRenderer.removeListener("signals:meta", metaHandler);
        } catch {}
        try {
          ipcRenderer.removeListener("signals:new", sigHandler);
        } catch {}
      };
    },
  },
};

/* ------------ Expose to window (مجمّدة للحماية) ------------ */
contextBridge.exposeInMainWorld("signals", Object.freeze(signalsAPI));
contextBridge.exposeInMainWorld("binance", Object.freeze(binanceAPI));
contextBridge.exposeInMainWorld("net", Object.freeze(netAPI));
// اختيارية: لو عندك صفحات قديمة تستخدم posAPI
contextBridge.exposeInMainWorld("posAPI", Object.freeze(posAPIShim));
