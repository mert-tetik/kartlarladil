/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, Notification, powerSaveBlocker, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const CONFIG_FILE = "renderer-agent.json";
const HEARTBEAT_MS = 15_000;
const SESSION_REFRESH_MS = 10 * 60 * 60_000;
let rendererWindow = null;
let sleepBlockerId = null;
let lastQueueState = "idle";

function configPath() { return path.join(app.getPath("userData"), CONFIG_FILE); }
function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    const token = raw.token && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(raw.token, "base64")) : "";
    return { siteUrl: raw.siteUrl || "", token };
  } catch { return { siteUrl: "", token: "" }; }
}
function saveConfig(config) {
  if (!config.siteUrl || !config.token || !safeStorage.isEncryptionAvailable()) return;
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ siteUrl: config.siteUrl.replace(/\/$/u, ""), token: safeStorage.encryptString(config.token).toString("base64") }), { mode: 0o600 });
}
function currentConfig() {
  const stored = readConfig();
  const siteUrl = process.env.FOXIESDECK_RENDERER_URL?.trim() || stored.siteUrl;
  const token = process.env.FOXIESDECK_RENDERER_TOKEN?.trim() || stored.token;
  if (process.env.FOXIESDECK_RENDERER_URL && process.env.FOXIESDECK_RENDERER_TOKEN) saveConfig({ siteUrl, token });
  return { siteUrl: siteUrl.replace(/\/$/u, ""), token };
}
function setSleepBlocker(active) {
  if (active && sleepBlockerId === null) sleepBlockerId = powerSaveBlocker.start("prevent-app-suspension");
  if (!active && sleepBlockerId !== null) { powerSaveBlocker.stop(sleepBlockerId); sleepBlockerId = null; }
}
function loadInfo(title, body, error = false) {
  rendererWindow.show();
  rendererWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><title>${title}</title><style>body{font:16px system-ui;background:#101212;color:#f7f3ed;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:540px;padding:32px;border:1px solid #ffffff22;border-radius:18px;background:#171a19}.error{color:#ffb9c1}code{color:#c7f05d}</style><main class=card><h1>${title}</h1><p class=${error ? "error" : ""}>${body}</p></main>`));
}
function showSetupWindow() { loadInfo("FoxiesDeck Renderer kurulumu", "Renderer tokenini Studio’dan oluşturduktan sonra uygulamayı FOXIESDECK_RENDERER_URL ve FOXIESDECK_RENDERER_TOKEN ortam değişkenleriyle bir kez başlat. Token Windows DPAPI ile şifrelenir; sosyal medya ve AI anahtarları bu uygulamaya aktarılmaz."); }
async function establishSession(config) {
  const response = await fetch(`${config.siteUrl}/api/twitter-automation/renderers/session`, { method: "POST", headers: { authorization: `Bearer ${config.token}` } });
  if (!response.ok) throw new Error(`renderer_session_${response.status}`);
  const setCookie = response.headers.get("set-cookie");
  const match = setCookie?.match(/foxiesdeck:automation-renderer=([^;]+)/u);
  if (!match) throw new Error("renderer_session_cookie_missing");
  const base = new URL(config.siteUrl);
  await rendererWindow.webContents.session.cookies.set({ url: `${base.protocol}//${base.host}`, name: "foxiesdeck:automation-renderer", value: match[1], httpOnly: true, secure: base.protocol === "https:", sameSite: "strict", path: "/" });
}
async function heartbeatAndObserve() {
  if (!rendererWindow || rendererWindow.isDestroyed()) return;
  try {
    const state = await rendererWindow.webContents.executeJavaScript(`(async () => { const heartbeat = await fetch('/api/twitter-automation/renderers/heartbeat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); const queues = await Promise.all(['production', 'test'].map(async (scope) => { const response = await fetch('/api/twitter-automation/automation-runs?scope=' + scope + '&active=1', { cache: 'no-store' }); return response.ok ? response.json() : { outputs: [] }; })); const active = queues.some((payload) => (payload.outputs || []).some((output) => !['scheduled', 'failed'].includes(output.status))); return { active, heartbeat: heartbeat.ok }; })()`);
    setSleepBlocker(Boolean(state?.active));
    const nextState = state?.active ? "working" : "idle";
    if (lastQueueState === "working" && nextState === "idle") new Notification({ title: "FoxiesDeck Renderer", body: "Render kuyruğu tamamlandı. Sonuçlar kontrol için hazır." }).show();
    lastQueueState = nextState;
  } catch { setSleepBlocker(false); }
}
async function startRenderer() {
  const config = currentConfig();
  if (!config.siteUrl || !config.token) return showSetupWindow();
  try {
    await establishSession(config);
    await rendererWindow.loadURL(`${config.siteUrl}/content-automation/renderer`);
    rendererWindow.hide();
    await heartbeatAndObserve();
    setInterval(() => void heartbeatAndObserve(), HEARTBEAT_MS);
    setInterval(() => void establishSession(config).catch(() => undefined), SESSION_REFRESH_MS);
  } catch { loadInfo("Renderer bağlanamadı", "Token veya ağ bağlantısını kontrol et. Uygulama Windows girişinde otomatik olarak tekrar açılır.", true); }
}
app.whenReady().then(async () => {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  rendererWindow = new BrowserWindow({ width: 720, height: 520, show: false, backgroundColor: "#101212", webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  rendererWindow.on("close", (event) => {
    if (!app.isQuitting) { event.preventDefault(); rendererWindow.hide(); return; }
    setSleepBlocker(false);
  });
  rendererWindow.webContents.on("did-fail-load", () => setTimeout(() => void startRenderer(), 30_000));
  await startRenderer();
});
app.on("before-quit", () => { app.isQuitting = true; setSleepBlocker(false); });
