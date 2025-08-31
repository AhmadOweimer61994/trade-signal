// electron/main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const readline = require("readline");

/* ===== Binance deps (خفيفة) ===== */
const crypto = require("crypto");
let HttpsProxyAgent;
try {
  ({ HttpsProxyAgent } = require("https-proxy-agent"));
} catch {}

/* ===== نافذة/بايثون ===== */
let win;
let pyChild = null;

/** مسارات التطوير */
const DEV_PY_DIR = "C:\\Users\\a7mad\\Desktop\\tele-signals";
const DEV_VENV_PY = path.join(DEV_PY_DIR, "venv", "Scripts", "python.exe");
const DEV_SCRIPT = path.join(DEV_PY_DIR, "tele_signal_bot.py");

/** اختيار بايثون مناسب */
function pickPythonExe() {
  if (!app.isPackaged && fs.existsSync(DEV_VENV_PY)) return DEV_VENV_PY;

  if (process.platform === "win32") {
    const test = spawnSync("py", ["-V"], { encoding: "utf8" });
    if (!test.error && (test.stdout || test.stderr)) return "py";
  }
  const testPy = spawnSync("python", ["-V"], { encoding: "utf8" });
  if (!testPy.error && (testPy.stdout || testPy.stderr)) return "python";

  const testPy3 = spawnSync("python3", ["-V"], { encoding: "utf8" });
  if (!testPy3.error && (testPy3.stdout || testPy3.stderr)) return "python3";

  return null;
}

/** تحديد مسار السكربت و CWD بحسب حالة التطوير/الإنتاج */
function resolveScriptPath() {
  if (!app.isPackaged) return { script: DEV_SCRIPT, cwd: DEV_PY_DIR };
  const candidates = [
    path.join(process.resourcesPath, "tele_signal_bot.py"),
    path.join(process.resourcesPath, "app", "tele_signal_bot.py"),
    path.join(process.resourcesPath, "app.asar.unpacked", "tele_signal_bot.py"),
    DEV_SCRIPT,
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return { script: p, cwd: path.dirname(p) };
  }
  return { script: DEV_SCRIPT, cwd: DEV_PY_DIR };
}

function spawnSignalBot() {
  if (pyChild) return;

  const pyExe = app.isPackaged
    ? path.join(process.resourcesPath, "python", "python.exe")
    : pickPythonExe();

  const { script, cwd } = resolveScriptPath();

  if (!fs.existsSync(script)) {
    const msg = `Python script not found at: ${script}`;
    console.error(msg);
    win?.webContents.send("signals:meta", { type: "spawn_error", data: msg });
    return;
  }
  if (!pyExe) {
    const msg = "No Python interpreter found. Install Python or create a venv.";
    console.error(msg);
    win?.webContents.send("signals:meta", { type: "spawn_error", data: msg });
    return;
  }

  win?.webContents.send("signals:meta", {
    type: "status",
    data: { stage: "starting" },
  });
  win?.webContents.send("signals:meta", {
    type: "spawn_info",
    data: { pyExe, cwd, script },
  });

  pyChild = spawn(pyExe, [script], {
    cwd,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  try {
    pyChild.stdin.setDefaultEncoding("utf-8");
  } catch {}

  const rl = readline.createInterface({
    input: pyChild.stdout,
    crlfDelay: Infinity,
  });
  rl.on("line", (raw) => {
    const line = (raw || "").trim();
    if (!line) return;

    if (!line.startsWith("@SIG@ ")) {
      win?.webContents.send("signals:meta", { type: "stdout", data: raw });
      return;
    }
    try {
      const obj = JSON.parse(line.slice(6));
      if (obj.type === "signal") win?.webContents.send("signals:new", obj.data);
      else win?.webContents.send("signals:meta", obj);
    } catch (e) {
      win?.webContents.send("signals:meta", {
        type: "parse_error",
        data: { line: raw, error: String(e) },
      });
    }
  });

  pyChild.stderr.on("data", (d) => {
    win?.webContents.send("signals:meta", {
      type: "stderr",
      data: d.toString(),
    });
  });

  pyChild.on("error", (err) => {
    win?.webContents.send("signals:meta", {
      type: "spawn_error",
      data: String(err),
    });
  });

  pyChild.on("close", (code) => {
    win?.webContents.send("signals:meta", { type: "exit", data: { code } });
    pyChild = null;
  });
}

function killSignalBot() {
  if (!pyChild) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/PID", String(pyChild.pid), "/T", "/F"]);
    } else {
      pyChild.kill("SIGTERM");
    }
  } catch {}
  pyChild = null;
}

// إرسال أوامر stdin إلى بايثون (@CMD@ {...})
function sendCmd(obj) {
  if (!pyChild || !pyChild.stdin || !pyChild.stdin.writable) {
    throw new Error("Python process is not running");
  }
  const line = "@CMD@ " + JSON.stringify(obj) + "\n";
  pyChild.stdin.write(line);
}

/* ===== Helpers: تأمين تشغيل البوت قبل أي IPC ===== */
function ensureBot() {
  if (!pyChild) spawnSignalBot();
  return !!pyChild;
}
async function ensureBotStarted(timeoutMs = 5000) {
  if (ensureBot()) return true;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (pyChild && pyChild.stdin && pyChild.stdin.writable) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !!(pyChild && pyChild.stdin && pyChild.stdin.writable);
}

/* ===== IPC: Signals (تيليجرام) ===== */
ipcMain.handle("signals:start", async () => {
  spawnSignalBot();
  return true;
});
ipcMain.handle("signals:stop", async () => {
  killSignalBot();
  return true;
});

ipcMain.handle("signals:cmd", async (_e, obj) => {
  const ok = await ensureBotStarted();
  if (!ok) {
    win?.webContents.send("signals:meta", {
      type: "spawn_error",
      data: "Python process is not running (auto-start failed)",
    });
    return { ok: false, error: "py_not_running" };
  }
  try {
    sendCmd(obj);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("signals:setTargets", async (_e, list) => {
  const ok = await ensureBotStarted();
  if (!ok) return { ok: false, error: "py_not_running" };
  sendCmd({ op: "set_targets", usernames: list });
  return { ok: true };
});
ipcMain.handle("signals:listTargets", async () => {
  const ok = await ensureBotStarted();
  if (!ok) return { ok: false, error: "py_not_running" };
  sendCmd({ op: "list_targets" });
  return { ok: true };
});
ipcMain.handle("signals:code", async (_e, code) => {
  const ok = await ensureBotStarted();
  if (!ok) return { ok: false, error: "py_not_running" };
  sendCmd({ op: "code", code });
  return { ok: true };
});
ipcMain.handle("signals:password", async (_e, password) => {
  const ok = await ensureBotStarted();
  if (!ok) return { ok: false, error: "py_not_running" };
  sendCmd({ op: "password", password });
  return { ok: true };
});
ipcMain.handle("signals:enter", async (_e, signal) => {
  const ok = await ensureBotStarted();
  if (!ok) return { ok: false, error: "py_not_running" };
  sendCmd({ op: "enter", signal });
  return { ok: true };
});

/* ======== تخزين Binance عبر lowdb (JSON) مع تشفير السر ======== */
// lowdb v1 (CommonJS)
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

function userDataPath() {
  try {
    return app.getPath("userData");
  } catch {
    return path.join(__dirname, ".");
  }
}
function dbFilePath() {
  return path.join(userDataPath(), "store.json");
}

let db;
function getDB() {
  if (!db) {
    const adapter = new FileSync(dbFilePath());
    db = low(adapter);
    db.defaults({ binance: { pub: null, priv: null } }).write();
  }
  return db;
}

// مفتاح تشفير محلي (يُنشأ مرة واحدة)
function keyPath() {
  return path.join(userDataPath(), "appkey.bin");
}
function getOrCreateKey() {
  try {
    return fs.readFileSync(keyPath());
  } catch {
    const k = crypto.randomBytes(32); // AES-256
    fs.writeFileSync(keyPath(), k);
    return k;
  }
}
function encSecret(plain) {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const c = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, c]).toString("base64"); // [IV(12)][TAG(16)][DATA]
}
function decSecret(b64) {
  if (!b64) return "";
  const buf = Buffer.from(b64, "base64");
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const dat = buf.slice(28);
  const key = getOrCreateKey();
  const dec = crypto.createDecipheriv("aes-256-gcm", key, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(dat), dec.final()]).toString("utf8");
}

/* ===== Helpers لبينانس ===== */
function baseUrlOf(domain, mode) {
  if (domain === "binance.us") return "https://api.binance.us"; // Spot فقط
  return mode === "futures"
    ? "https://fapi.binance.com"
    : "https://api.binance.com";
}
function signUrl({ baseUrl, path, params, secret }) {
  const usp = new URLSearchParams(params);
  const sig = crypto
    .createHmac("sha256", secret)
    .update(usp.toString())
    .digest("hex");
  return `${baseUrl}${path}?${usp.toString()}&signature=${sig}`;
}
function agentOf(proxy) {
  if (!proxy || !HttpsProxyAgent) return undefined;
  try {
    return new HttpsProxyAgent(proxy);
  } catch {
    return undefined;
  }
}

/* === IP عمومي (يستخدم proxy لو متوفر) === */
// === IP عمومي (يقبل إما string proxy أو كائن { proxy }) ===
ipcMain.handle("net:publicIP", async (_e, arg) => {
  const proxy = typeof arg === "string" ? arg : arg?.proxy || "";
  try {
    const agent = agentOf?.(proxy);
    const res = await fetch("https://api.ipify.org?format=json", { agent });
    const j = await res.json();
    return { ok: true, ip: j.ip };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/* === حفظ الإعدادات (JSON + تشفير السر) — لا نعيد السر للواجهة === */
ipcMain.handle("binance:save", async (_e, cfg) => {
  try {
    if (!cfg?.apiKey || !cfg?.apiSecret)
      return { ok: false, error: "Missing API key/secret" };
    if (cfg.domain === "binance.us" && cfg.mode === "futures")
      return { ok: false, error: "Futures غير مدعومة على binance.us" };

    const pub = {
      apiKey: cfg.apiKey,
      domain: cfg.domain || "binance.com",
      mode: cfg.mode || "spot",
      recvWindow: Number(cfg.recvWindow) || 5000,
      proxy: cfg.proxy || "",
    };
    const priv = { apiSecretEnc: encSecret(cfg.apiSecret) };

    const _db = getDB();
    _db.set("binance.pub", pub).write();
    _db.set("binance.priv", priv).write();

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/* === تحميل الإعدادات (بدون إعادة السر) === */
ipcMain.handle("binance:load", async () => {
  try {
    const _db = getDB();
    const pub = _db.get("binance.pub").value() || {
      apiKey: "",
      domain: "binance.com",
      mode: "spot",
      recvWindow: 5000,
      proxy: "",
    };
    return pub;
  } catch (e) {
    return {
      apiKey: "",
      domain: "binance.com",
      mode: "spot",
      recvWindow: 5000,
      proxy: "",
      error: String(e),
    };
  }
});

/* === تحديث عام (domain/mode/recvWindow/proxy) === */
ipcMain.handle("binance:update", async (_e, patch = {}) => {
  try {
    const _db = getDB();
    const cur = _db.get("binance.pub").value();
    if (!cur) return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };

    // إجبار Spot دائمًا
    const domain = patch.domain ?? cur.domain;
    const next = {
      ...cur,
      domain,
      mode: "spot",
      recvWindow: Number(patch.recvWindow ?? cur.recvWindow ?? 5000),
      proxy: patch.proxy ?? cur.proxy ?? "",
    };
    _db.set("binance.pub", next).write();
    return { ok: true, pub: next };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/* === تحويل سريع إلى binance.us/spot === */
ipcMain.handle("binance:switchToUS", async () => {
  try {
    const _db = getDB();
    const cur = _db.get("binance.pub").value();
    if (!cur) return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };
    const next = { ...cur, domain: "binance.us", mode: "spot" };
    _db.set("binance.pub", next).write();
    return { ok: true, pub: next };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/* === رصيد الحساب فقط (Spot/Futures) === */
ipcMain.handle("binance:balances", async () => {
  const _db = getDB();
  const pub = _db.get("binance.pub").value();
  const priv = _db.get("binance.priv").value();
  if (!pub || !priv)
    return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };

  const apiKey = pub.apiKey;
  const apiSecret = decSecret(priv.apiSecretEnc);
  const domain = pub.domain || "binance.com";
  const mode = pub.mode || "spot";
  const recvWindow = Number(pub.recvWindow) || 5000;
  const proxy = pub.proxy || "";
  const baseUrl = baseUrlOf(domain, mode);
  const agent = agentOf(proxy);

  try {
    if (mode === "futures") {
      const url = signUrl({
        baseUrl,
        path: "/fapi/v2/balance",
        secret: apiSecret,
        params: { timestamp: Date.now(), recvWindow },
      });
      const res = await fetch(url, {
        headers: { "X-MBX-APIKEY": apiKey },
        agent,
      });
      const data = await res.json();
      if (!res.ok)
        return {
          ok: false,
          error: data?.msg || res.statusText,
          status: res.status,
        };

      const balances = (Array.isArray(data) ? data : [])
        .filter(
          (x) => Number(x.balance) > 0 || Number(x.crossWalletBalance) > 0
        )
        .map((x) => ({
          asset: x.asset,
          free: x.balance,
          locked: 0,
          crossWallet: x.crossWalletBalance,
        }));

      return { ok: true, domain, mode, balances };
    } else {
      const url = signUrl({
        baseUrl,
        path: "/api/v3/account",
        secret: apiSecret,
        params: { timestamp: Date.now(), recvWindow },
      });
      const res = await fetch(url, {
        headers: { "X-MBX-APIKEY": apiKey },
        agent,
      });
      const data = await res.json();
      if (!res.ok)
        return {
          ok: false,
          error: data?.msg || res.statusText,
          status: res.status,
        };

      const balances = (data?.balances || [])
        .filter((b) => Number(b.free) > 0 || Number(b.locked) > 0)
        .map((b) => ({ asset: b.asset, free: b.free, locked: b.locked }));

      return { ok: true, domain, mode, balances };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/* === نظرة عامة: ارجاع الرصيد + مُعرّف الحساب (لا يوجد اسم عبر API) === */
ipcMain.handle("binance:overview", async () => {
  const _db = getDB();
  const pub = _db.get("binance.pub").value();
  const priv = _db.get("binance.priv").value();
  if (!pub || !priv)
    return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };

  const apiKey = pub.apiKey;
  const apiSecret = decSecret(priv.apiSecretEnc);
  const domain = pub.domain || "binance.com";
  const mode = pub.mode || "spot";
  const recvWindow = Number(pub.recvWindow) || 5000;
  const proxy = pub.proxy || "";
  const baseUrl = baseUrlOf(domain, mode);
  const agent = agentOf(proxy);

  try {
    let balances = [];
    if (mode === "futures") {
      const url = signUrl({
        baseUrl,
        path: "/fapi/v2/balance",
        secret: apiSecret,
        params: { timestamp: Date.now(), recvWindow },
      });
      const res = await fetch(url, {
        headers: { "X-MBX-APIKEY": apiKey },
        agent,
      });
      const data = await res.json();
      if (!res.ok)
        return {
          ok: false,
          error: data?.msg || res.statusText,
          status: res.status,
        };

      balances = (Array.isArray(data) ? data : [])
        .filter(
          (x) => Number(x.balance) > 0 || Number(x.crossWalletBalance) > 0
        )
        .map((x) => ({
          asset: x.asset,
          free: x.balance,
          locked: 0,
          crossWallet: x.crossWalletBalance,
        }));
    } else {
      const url = signUrl({
        baseUrl,
        path: "/api/v3/account",
        secret: apiSecret,
        params: { timestamp: Date.now(), recvWindow },
      });
      const res = await fetch(url, {
        headers: { "X-MBX-APIKEY": apiKey },
        agent,
      });
      const data = await res.json();
      if (!res.ok)
        return {
          ok: false,
          error: data?.msg || res.statusText,
          status: res.status,
        };

      balances = (data?.balances || [])
        .filter((b) => Number(b.free) > 0 || Number(b.locked) > 0)
        .map((b) => ({ asset: b.asset, free: b.free, locked: b.locked }));
    }

    return {
      ok: true,
      account: {
        domain,
        mode,
        label: `${domain} • ${String(mode).toUpperCase()}`,
        id: `…${String(apiKey).slice(-6)}`, // بديل لاسم المستخدم (غير متاح عبر API)
      },
      balances,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/* === اختبار اتصال موقعّ (Spot/Futures) بالاعتماد على DB إن لم تُمرّر مفاتيح === */
ipcMain.handle("binance:test", async (_e, inCfg) => {
  try {
    const _db = getDB();
    const pub = _db.get("binance.pub").value() || {};
    const priv = _db.get("binance.priv").value() || {};

    const apiKey = inCfg?.apiKey || pub.apiKey;
    const apiSecret =
      inCfg?.apiSecret ||
      (priv.apiSecretEnc ? decSecret(priv.apiSecretEnc) : undefined);
    const domain = inCfg?.domain || pub.domain || "binance.com";
    const mode = inCfg?.mode || pub.mode || "spot";
    const recvWindow = Number(inCfg?.recvWindow ?? pub.recvWindow ?? 5000);
    const proxy = inCfg?.proxy || pub.proxy || "";

    if (!apiKey || !apiSecret)
      return { ok: false, error: "API key/secret غير متوفر" };
    if (domain === "binance.us" && mode === "futures")
      return { ok: false, error: "Futures غير مدعومة على binance.us" };

    const baseUrl = baseUrlOf(domain, mode);
    const path = mode === "futures" ? "/fapi/v2/balance" : "/api/v3/account";
    const url = signUrl({
      baseUrl,
      path,
      secret: apiSecret,
      params: { timestamp: Date.now(), recvWindow },
    });

    const res = await fetch(url, {
      headers: { "X-MBX-APIKEY": apiKey },
      agent: agentOf(proxy),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok)
      return {
        ok: false,
        error: json?.msg || res.statusText || "HTTP Error",
        status: res.status,
        body: json,
      };

    return {
      ok: true,
      baseUrl,
      mode,
      domain,
      sample: Array.isArray(json)
        ? json.slice(0, 3)
        : { keys: Object.keys(json).slice(0, 8) },
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
/* === helper: vault لإرجاع المفاتيح مفكوكة === */
function ensureVault() {
  const _db = getDB();
  return {
    getCfg() {
      const pub = _db.get("binance.pub").value();
      const priv = _db.get("binance.priv").value();
      if (!pub || !priv || !priv.apiSecretEnc) return null;
      return {
        apiKey: pub.apiKey,
        apiSecret: decSecret(priv.apiSecretEnc),
        domain: pub.domain || "binance.com",
        mode: pub.mode || "spot",
        recvWindow: Number(pub.recvWindow) || 5000,
        proxy: pub.proxy || "",
      };
    },
  };
}

// === معلومات الرمز (يقبل string أو { symbol }) ===
ipcMain.handle("binance:exchangeInfo", async (_e, arg) => {
  const symbol = typeof arg === "string" ? arg : arg?.symbol;

  try {
    if (!symbol) return { ok: false, error: "missing_symbol" };

    const vault = ensureVault();
    const cur = vault.getCfg();
    if (!cur) return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };

    const baseUrl = baseUrlOf(cur.domain, cur.mode);
    const path =
      cur.mode === "futures" ? "/fapi/v1/exchangeInfo" : "/api/v3/exchangeInfo";
    const url = `${baseUrl}${path}?symbol=${encodeURIComponent(
      String(symbol).toUpperCase()
    )}`;

    const res = await fetch(url, { agent: agentOf(cur.proxy) });
    const j = await res.json();
    if (!res.ok)
      return { ok: false, error: j?.msg || res.statusText, status: res.status };

    const sym = (j.symbols && j.symbols[0]) || j.symbol || null;
    if (!sym) return { ok: false, error: "symbol_not_found" };

    const get = (type) => {
      const f = (sym.filters || []).find((x) => x.filterType === type);
      return f || {};
    };
    const lot = get("LOT_SIZE");
    const priceF = get("PRICE_FILTER");
    const minNot = get("MIN_NOTIONAL");

    return {
      ok: true,
      info: {
        baseAsset: sym.baseAsset,
        quoteAsset: sym.quoteAsset,
        stepSize: lot.stepSize || "0.00000001",
        minQty: lot.minQty || "0",
        tickSize: priceF.tickSize || "0.00000001",
        minNotional: minNot.minNotional || "0",
      },
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("binance:order", async (_e, payload = {}) => {
  try {
    const vault = ensureVault();
    const cur = vault.getCfg();
    if (!cur) return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };

    const { apiKey, apiSecret, recvWindow, proxy } = cur;
    const baseUrl = baseUrlOf(cur.domain, "spot"); // إجبار Spot

    const p = {
      symbol: String(payload.symbol || "").toUpperCase(),
      side: String(payload.side || "").toUpperCase(), // BUY | SELL
      type: String(payload.type || "").toUpperCase(), // LIMIT | MARKET | ...
      timeInForce: payload.timeInForce, // GTC لـ LIMIT
      quantity: payload.quantity, // (اختياري) كميّة
      quoteOrderQty: payload.quoteOrderQty, // (اختياري) USDT للـ MARKET BUY
      price: payload.price, // للسعر في LIMIT
      newClientOrderId: payload.newClientOrderId, // (اختياري)
      timestamp: Date.now(),
      recvWindow: Number(recvWindow) || 5000,
    };

    // نظّف المفاتيح الفارغة
    Object.keys(p).forEach((k) => (p[k] == null || p[k] === "") && delete p[k]);

    if (!p.symbol || !p.side || !p.type)
      return { ok: false, error: "missing_params" };

    // توقيع الطلب
    const usp = new URLSearchParams(p);
    const sig = crypto
      .createHmac("sha256", apiSecret)
      .update(usp.toString())
      .digest("hex");
    usp.append("signature", sig);

    const res = await fetch(`${baseUrl}/api/v3/order`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: usp,
      agent: agentOf(proxy),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok)
      return {
        ok: false,
        error: json?.msg || res.statusText,
        status: res.status,
        body: json,
      };
    return { ok: true, order: json };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("binance:price", async (_e, arg) => {
  const symbol = typeof arg === "string" ? arg : arg?.symbol;
  try {
    if (!symbol) return { ok: false, error: "missing_symbol" };

    const vault = ensureVault();
    const cur = vault.getCfg();
    if (!cur) return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };

    // إجبار Spot
    const baseUrl = baseUrlOf(cur.domain, "spot");
    const url = `${baseUrl}/api/v3/ticker/price?symbol=${encodeURIComponent(
      String(symbol).toUpperCase()
    )}`;

    const res = await fetch(url, { agent: agentOf(cur.proxy) });
    const j = await res.json();
    if (!res.ok)
      return { ok: false, error: j?.msg || res.statusText, status: res.status };
    return { ok: true, price: Number(j.price), raw: j };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("binance:oco", async (_e, payload = {}) => {
  const vault = ensureVault();
  const cur = vault.getCfg();
  if (!cur) return { ok: false, error: "لا توجد مفاتيح محفوظة؛ احفظ أولاً." };
  if (cur.mode !== "spot") return { ok: false, error: "oco_spot_only" };

  const { apiKey, apiSecret, recvWindow, proxy } = cur;
  const baseUrl = baseUrlOf(cur.domain, cur.mode);

  const symbol = String(payload.symbol || "").toUpperCase();
  const quantity = String(payload.quantity || "");
  const price = String(payload.price || ""); // TP
  const stopPrice = String(payload.stopPrice || ""); // SL trigger
  const stopLimitPrice = String(payload.stopLimitPrice || ""); // SL limit

  if (!symbol || !quantity || !price || !stopPrice || !stopLimitPrice)
    return { ok: false, error: "missing_params" };

  try {
    const params = {
      symbol,
      side: "SELL",
      quantity,
      price,
      stopPrice,
      stopLimitPrice,
      stopLimitTimeInForce: payload.stopLimitTimeInForce || "GTC",
      timestamp: Date.now(),
      recvWindow: Number(recvWindow) || 5000,
    };
    const usp = new URLSearchParams(params);
    const sig = crypto
      .createHmac("sha256", apiSecret)
      .update(usp.toString())
      .digest("hex");
    usp.append("signature", sig);

    const res = await fetch(`${baseUrl}/api/v3/order/oco`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: usp,
      agent: agentOf(proxy),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok)
      return {
        ok: false,
        error: json?.msg || res.statusText,
        status: res.status,
        body: json,
      };
    return { ok: true, oco: json };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/* ===== نافذة ===== */
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (!app.isPackaged) win.loadURL("http://localhost:5173");
  else win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));

  win.webContents.once("did-finish-load", () => spawnSignalBot());
}

app.whenReady().then(createWindow);
app.on("before-quit", killSignalBot);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    killSignalBot();
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
