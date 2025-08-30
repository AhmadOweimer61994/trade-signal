// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

/* ------------ Utils: event bus per-channel ------------ */
function makeOn(channel) {
  const listeners = new Set();
  const handler = (_e, payload) => {
    for (const cb of listeners) {
      try { cb(payload); } catch {}
    }
  };
  ipcRenderer.on(channel, handler);

  // تنظيف تلقائي عند إغلاق الصفحة (reload/HMR)
  const cleanup = () => {
    try { ipcRenderer.removeListener(channel, handler); } catch {}
    listeners.clear();
  };
  window.addEventListener?.('beforeunload', cleanup);

  return {
    on(cb) { listeners.add(cb); },
    off(cb) { listeners.delete(cb); },
    _handler: handler,
    _cleanup: cleanup,
  };
}

const newBus  = makeOn('signals:new');
const metaBus = makeOn('signals:meta');

/* ------------ Utils: invoke with graceful fallback ------------ */
async function _invokeOrCmd(specificChannel, specificArgs, cmdPayload) {
  try {
    // جرّب القناة المتخصصة إن كانت موجودة في main.js
    return await ipcRenderer.invoke(specificChannel, ...(specificArgs || []));
  } catch {
    // فallback إلى القناة العامة signals:cmd
    return await ipcRenderer.invoke('signals:cmd', cmdPayload);
  }
}

function _normalizeTargets(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(x => String(x ?? '').trim())
    .filter(Boolean);
}

/* ------------ Public API ------------ */
const api = {
  /* تشغيل/إيقاف بايثون */
  start: () => ipcRenderer.invoke('signals:start'),
  stop:  () => ipcRenderer.invoke('signals:stop'),

  /* الاشتراك في الأحداث */
  onNew:  (cb) => newBus.on(cb),
  offNew: (cb) => newBus.off(cb),
  onMeta: (cb) => metaBus.on(cb),
  offMeta:(cb) => metaBus.off(cb),

  /* تعيين أهداف الاستماع (قنوات/يوزرات) */
  setTargets: (list) => {
    const targets = _normalizeTargets(list);
    if (!targets.length) return Promise.resolve(false);
    return _invokeOrCmd('signals:setTargets', [targets], { op: 'set_targets', usernames: targets });
  },

  /* تعيين هدف واحد بسرعة من حقل إدخال */
  setTarget: (name) => {
    const t = String(name ?? '').trim();
    if (!t) return Promise.resolve(false);
    return _invokeOrCmd('signals:setTargets', [[t]], { op: 'set_targets', usernames: [t] });
  },

  /* طلب عرض/إرجاع الأهداف الحالية */
  listTargets: () => _invokeOrCmd('signals:listTargets', [], { op: 'list_targets' }),

  /* أوامر تسجيل الدخول التفاعلية */
  sendCode: (code) =>
    _invokeOrCmd('signals:code', [String(code ?? '').trim()], { op: 'code', code: String(code ?? '').trim() }),

  sendPassword: (password) =>
    _invokeOrCmd('signals:password', [String(password ?? '')], { op: 'password', password: String(password ?? '') }),

  resendCode: () =>
    ipcRenderer.invoke('signals:cmd', { op: 'resend_code' }),

  /* إدارة الجلسة/الخروج */
  resetSession: () =>
    ipcRenderer.invoke('signals:cmd', { op: 'reset_session' }),

  exitBot: () =>
    ipcRenderer.invoke('signals:cmd', { op: 'stop' }),

  /* عمليات على الرسائل/السيجنال */
  // ملاحظة: اسم الدالة "delete" ممكن يسبب التباس، فوفّرنا alias كذلك:
  delete: (messageId) =>
    ipcRenderer.invoke('signals:cmd', { op: 'delete', message_id: messageId }),

  deleteMessage: (messageId) =>
    ipcRenderer.invoke('signals:cmd', { op: 'delete', message_id: messageId }),

  /* إدخال صفقة */
  enter: (signalRow) =>
    _invokeOrCmd('signals:enter', [signalRow], { op: 'enter', signal: signalRow }),

  /* قناة عامة احتياطية لأي أوامر مستقبلية */
  cmd: (obj) => ipcRenderer.invoke('signals:cmd', obj),
};

contextBridge.exposeInMainWorld('binance', {
  save: (cfg) => ipcRenderer.invoke('binance:save', cfg),   // يخزن apiKey/secret مشفّرًا
  load: () => ipcRenderer.invoke('binance:load'),
  test: (cfg) => ipcRenderer.invoke('binance:test', cfg),
   update: (patch) => ipcRenderer.invoke('binance:update', patch),
  switchToUS:     () => ipcRenderer.invoke('binance:switchToUS'),   // ينفّذ /api/v3/account أو /fapi/v2/balance على baseUrl
})


contextBridge.exposeInMainWorld('net', {
  publicIP: (proxy) => ipcRenderer.invoke('net:publicIP', proxy),
})



contextBridge.exposeInMainWorld('signals', api);
