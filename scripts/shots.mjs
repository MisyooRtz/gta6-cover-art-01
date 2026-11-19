// Renders screenshots/ from shots.json through headless Chrome (CDP).
// Dev-only helper — not part of the app handed in.
//
//   node scripts/shots.mjs            renders every shot in shots.json
//   node scripts/shots.mjs export-test verifies the export path and saves
//                                     the exported PNG to /tmp/export-test.png
//
// It starts its own copy of serve.ts on port 8080, waits for each page's
// window.__shotReady, then captures a JPEG. Deterministic: same app bytes
// in, same pixels out.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const HOME = process.env.HOME ?? '/home/hatch';
const CHROME = process.env.CHROME
  ?? `${HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const PORT = Number(process.env.SHOT_PORT ?? 8080);
const DEBUG_PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${url}`);
    await sleep(250);
  }
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
    return new CDP(ws);
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const { result } = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.value;
  }

  async waitForReady(timeoutMs = 30000) {
    const start = Date.now();
    for (;;) {
      if (await this.evaluate('window.__shotReady === true')) return;
      if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for __shotReady');
      await sleep(200);
    }
  }

  close() {
    this.ws.close();
  }
}

async function openPage(url, width, height) {
  const created = await (await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' },
  )).json();
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const target = targets.find((t) => t.id === created.id);
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  return { cdp, target };
}

async function closePage(target) {
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${target.id}`);
}

async function captureShot(shot) {
  const url = `http://127.0.0.1:${PORT}/${shot.query}`;
  const { cdp, target } = await openPage(url, shot.w, shot.h);
  try {
    await cdp.waitForReady();
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    const bytes = Buffer.from(data, 'base64');
    writeFileSync(join(repo, 'screenshots', shot.name), bytes);
    console.log(`${shot.name}: ${shot.w}x${shot.h} ${bytes.length} bytes`);
  } finally {
    cdp.close();
    await closePage(target);
  }
}

async function exportTest() {
  const url = `http://127.0.0.1:${PORT}/?shot=export-test&photo=pier&caption=Sunset%20Heist`;
  const { cdp, target } = await openPage(url, 1080, 1080);
  try {
    const start = Date.now();
    let info = null;
    while (Date.now() - start < 30000) {
      info = await cdp.evaluate('window.__exportInfo ?? null');
      if (info) break;
      await sleep(200);
    }
    if (!info) throw new Error('no __exportInfo after 30s');
    if (info.error) throw new Error(`export failed in page: ${info.error}`);
    const png = Buffer.from(info.dataUrl.split(',')[1], 'base64');
    writeFileSync('/tmp/export-test.png', png);
    console.log(`export-test: PNG ${info.width}x${info.height}, blob ${info.bytes} bytes, file ${png.length} bytes, mime ${info.mime}`);
    if (png.length !== info.bytes) throw new Error(`size mismatch: blob ${info.bytes} vs file ${png.length}`);
  } finally {
    cdp.close();
    await closePage(target);
  }
}

async function main() {
  const mode = process.argv[2] ?? 'shots';
  const server = spawn(process.execPath, [join(repo, 'serve.ts'), '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=/tmp/vs-chrome-${DEBUG_PORT}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await waitFor(`http://127.0.0.1:${PORT}/`);
    await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    if (mode === 'export-test') await exportTest();
    else {
      const shots = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));
      mkdirSync(join(repo, 'screenshots'), { recursive: true });
      for (const shot of shots) await captureShot(shot);
    }
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

main().catch((error) => {
  console.error(`shots.mjs: ${error.message}`);
  process.exit(1);
});
