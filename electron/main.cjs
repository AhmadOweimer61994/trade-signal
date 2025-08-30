// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

/* ===== Binance deps (خفيفة) ===== */
const crypto = require('crypto');
let HttpsProxyAgent;
try { ({ HttpsProxyAgent } = require('https-proxy-agent')); } catch {}

/* ===== نافذة/بايثون ===== */
let win;
let pyChild = null;

/** مسارات التطوير */
const DEV_PY_DIR = 'C:\\Users\\Khalid Abu Hawwas\\OneDrive\\Desktop\\tele-signals';
const DEV_VENV_PY = path.join(DEV_PY_DIR, 'venv', 'Scripts', 'python.exe');
const DEV_SCRIPT  = path.join(DEV_PY_DIR, 'tele_signal_bot.py');

/** اختيار بايثون مناسب */
function pickPythonExe() {
  // استخدم venv أولاً إن وجد
  if (!app.isPackaged && fs.existsSync(DEV_VENV_PY)) return DEV_VENV_PY;

  if (process.platform === 'win32') {
    const test = spawnSync('py', ['-V'], { encoding: 'utf8' });
    if (!test.error && (test.stdout || test.stderr)) return 'py';
  }

  const testPy = spawnSync('python', ['-V'], { encoding: 'utf8' });
  if (!testPy.error && (testPy.stdout || testPy.stderr)) return 'python';

  const testPy3 = spawnSync('python3', ['-V'], { encoding: 'utf8' });
  if (!testPy3.error && (testPy3.stdout || testPy3.stderr)) return 'python3';

  return null;
}

/** تحديد مسار السكربت و CWD بحسب حالة التطوير/الإنتاج */
function resolveScriptPath() {
  if (!app.isPackaged) {
    return { script: DEV_SCRIPT, cwd: DEV_PY_DIR };
  }
  // في الإنتاج: جرّب عدّة مواقع شائعة داخل resources
  const candidates = [
    path.join(process.resourcesPath, 'tele_signal_bot.py'),
    path.join(process.resourcesPath, 'app', 'tele_signal_bot.py'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'tele_signal_bot.py'),
    DEV_SCRIPT, // كنسخة أخيرة: مسار التطوير (لو شغلت نسخة محمولة)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return { script: p, cwd: path.dirname(p) };
  }
  return { script: DEV_SCRIPT, cwd: DEV_PY_DIR };
}

function spawnSignalBot() {
  if (pyChild) return; // Already running

  // اختر مفسّر بايثون
  const pyExe = app.isPackaged
    ? path.join(process.resourcesPath, 'python', 'python.exe')  // لو بتضمّن بايثون مع التطبيق
    : pickPythonExe();

  const { script, cwd } = resolveScriptPath();

  if (!fs.existsSync(script)) {
    const msg = `Python script not found at: ${script}`;
    console.error(msg);
    win?.webContents.send('signals:meta', { type: 'spawn_error', data: msg });
    return;
  }
  if (!pyExe) {
    const msg = 'No Python interpreter found. Install Python or create a venv.';
    console.error(msg);
    win?.webContents.send('signals:meta', { type: 'spawn_error', data: msg });
    return;
  }

  win?.webContents.send('signals:meta', { type: 'spawn_info', data: { pyExe, cwd, script } });

  pyChild = spawn(pyExe, [script], {
    cwd,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // مهم لكتابة UTF-8 إلى stdin
  try { pyChild.stdin.setDefaultEncoding('utf-8'); } catch {}

  // اقرأ stdout كسطر/سطر
  const rl = readline.createInterface({ input: pyChild.stdout, crlfDelay: Infinity });
  rl.on('line', (raw) => {
    const line = (raw || '').trim();
    if (!line) return;

    if (!line.startsWith('@SIG@ ')) {
      // stdout عادي (ديبَغ)
      win?.webContents.send('signals:meta', { type: 'stdout', data: raw });
      return;
    }
    try {
      const obj = JSON.parse(line.slice(6));
      if (obj.type === 'signal') {
        win?.webContents.send('signals:new', obj.data);
      } else {
        win?.webContents.send('signals:meta', obj);
      }
    } catch (e) {
      win?.webContents.send('signals:meta', { type: 'parse_error', data: { line: raw, error: String(e) } });
    }
  });

  pyChild.stderr.on('data', (d) => {
    win?.webContents.send('signals:meta', { type: 'stderr', data: d.toString() });
  });

  pyChild.on('error', (err) => {
    win?.webContents.send('signals:meta', { type: 'spawn_error', data: String(err) });
  });

  pyChild.on('close', (code) => {
    win?.webContents.send('signals:meta', { type: 'exit', data: { code } });
    pyChild = null;
  });
}

function killSignalBot() {
  if (!pyChild) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(pyChild.pid), '/T', '/F']);
    } else {
      pyChild.kill('SIGTERM');
    }
  } catch {}
  pyChild = null;
}

// إرسال أوامر stdin إلى بايثون (@CMD@ {...})
function sendCmd(obj) {
  if (!pyChild || !pyChild.stdin || !pyChild.stdin.writable) {
    throw new Error('Python process is not running');
  }
  const line = '@CMD@ ' + JSON.stringify(obj) + '\n';
  pyChild.stdin.write(line);
}

/* ===== IPC: Signals (تيليجرام) ===== */
ipcMain.handle('signals:start', async () => { spawnSignalBot(); return true; });
ipcMain.handle('signals:stop',  async () => { killSignalBot();  return true; });

// قناة عامة (تبقى موجودة للاستخدام الحر)
ipcMain.handle('signals:cmd', async (_e, obj) => { sendCmd(obj); return true; });

// قنوات مختصرة مهمّة
ipcMain.handle('signals:setTargets', async (_e, list) => { sendCmd({ op: 'set_targets', usernames: list }); return true; });
ipcMain.handle('signals:listTargets', async () => { sendCmd({ op: 'list_targets' }); return true; });
ipcMain.handle('signals:code', async (_e, code) => { sendCmd({ op: 'code', code }); return true; });
ipcMain.handle('signals:password', async (_e, password) => { sendCmd({ op: 'password', password }); return true; });
ipcMain.handle('signals:enter', async (_e, signal) => { sendCmd({ op: 'enter', signal }); return true; });

/* ===== IPC: Binance (Mainnet فقط) ===== */
/* تخزين بسيط بالذاكرة — استبدله لاحقًا بـ electron-store/keytar إذا رغبت */
const mem = { pub: null, priv: null };

function baseUrlOf(domain, mode) {
  if (domain === 'binance.us') return 'https://api.binance.us'; // Spot فقط
  return mode === 'futures' ? 'https://fapi.binance.com' : 'https://api.binance.com';
}
function signUrl({ baseUrl, path, params, secret }) {
  const usp = new URLSearchParams(params);
  const sig = crypto.createHmac('sha256', secret).update(usp.toString()).digest('hex');
  return `${baseUrl}${path}?${usp.toString()}&signature=${sig}`;
}
function agentOf(proxy) {
  if (!proxy || !HttpsProxyAgent) return undefined;
  try { return new HttpsProxyAgent(proxy); } catch { return undefined; }
}


ipcMain.handle('net:publicIP', async (_e, proxy) => {
  try {
    const agent = agentOf?.(proxy)
    const r = await fetch('https://api.ipify.org?format=json', { agent })
    const j = await r.json()
    return { ok: true, ip: j.ip }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('binance:update', async (_e, patch = {}) => {
  if (!mem.pub || !mem.priv) return { ok: false, error: 'لا توجد مفاتيح محفوظة؛ احفظ أولاً.' };

  const domain = patch.domain ?? mem.pub.domain;
  const mode   = patch.mode   ?? mem.pub.mode;

  if (domain === 'binance.us' && mode === 'futures') {
    return { ok: false, error: 'Futures غير مدعومة على binance.us' };
  }

  mem.pub = {
    ...mem.pub,
    domain,
    mode,
    recvWindow: Number(patch.recvWindow ?? mem.pub.recvWindow ?? 5000),
    proxy: patch.proxy ?? mem.pub.proxy ?? '',
  };
  return { ok: true, pub: mem.pub };
});

// تحويل سريع وثابت إلى Binance.US + Spot
ipcMain.handle('binance:switchToUS', async () => {
  if (!mem.pub || !mem.priv) return { ok: false, error: 'لا توجد مفاتيح محفوظة؛ احفظ أولاً.' };
  mem.pub.domain = 'binance.us';
  mem.pub.mode   = 'spot';
  return { ok: true, pub: mem.pub };
});

// حفظ الإعدادات (لا نُعيد السر للواجهة)
ipcMain.handle('binance:save', async (_e, cfg) => {
  if (!cfg?.apiKey || !cfg?.apiSecret) throw new Error('Missing API key/secret');
  if (cfg.domain === 'binance.us' && cfg.mode === 'futures') throw new Error('Futures غير مدعومة على binance.us');
  mem.pub = {
    apiKey: cfg.apiKey,
    domain: cfg.domain || 'binance.com',
    mode: cfg.mode || 'spot',
    recvWindow: Number(cfg.recvWindow) || 5000,
    proxy: cfg.proxy || ''
  };
  mem.priv = { apiSecret: cfg.apiSecret };
  return { ok: true };
});

// تحميل (بدون السر)
ipcMain.handle('binance:load', async () => {
  return mem.pub || { apiKey: '', domain: 'binance.com', mode: 'spot', recvWindow: 5000, proxy: '' };
});

// اختبار اتصال موقّع على Mainnet
ipcMain.handle('binance:test', async (_e, inCfg) => {
  const pub  = mem.pub  || {};
  const priv = mem.priv || {};
  const apiKey     = inCfg?.apiKey     || pub.apiKey;
  const apiSecret  = inCfg?.apiSecret  || priv.apiSecret;
  const domain     = inCfg?.domain     || pub.domain || 'binance.com';
  const mode       = inCfg?.mode       || pub.mode   || 'spot';
  const recvWindow = Number(inCfg?.recvWindow ?? pub.recvWindow ?? 5000);
  const proxy      = inCfg?.proxy      || pub.proxy || '';

  if (!apiKey || !apiSecret) return { ok: false, error: 'API key/secret غير متوفر' };
  if (domain === 'binance.us' && mode === 'futures') return { ok: false, error: 'Futures غير مدعومة على binance.us' };

  const baseUrl = baseUrlOf(domain, mode);
  const path = mode === 'futures' ? '/fapi/v2/balance' : '/api/v3/account';
  const url = signUrl({ baseUrl, path, secret: apiSecret, params: { timestamp: Date.now(), recvWindow } });

  try {
    const res = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey }, agent: agentOf(proxy) });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
      return { ok: false, error: json?.msg || res.statusText || 'HTTP Error', status: res.status, body: json };
    }
    return {
      ok: true,
      baseUrl, mode, domain,
      sample: Array.isArray(json) ? json.slice(0, 3) : { keys: Object.keys(json).slice(0, 8) }
    };
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
      preload: path.join(__dirname, 'preload.cjs'), // تأكد المسار صحيح عندك
    }
  });

  if (!app.isPackaged) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));

  win.webContents.once('did-finish-load', () => spawnSignalBot());
}

app.whenReady().then(createWindow);
app.on('before-quit', killSignalBot);
app.on('window-all-closed', () => {
  // لو حابّ تُغلق البوت عند إغلاق كل النوافذ (على ويندوز/لينكس)
  if (process.platform !== 'darwin') {
    killSignalBot();
    app.quit();
  }
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
