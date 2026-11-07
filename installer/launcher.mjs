import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBrowser } from './browser-install.mjs';

// This file runs from the installed bundle using its bundled Windows Node.exe.
const installDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(installDir, 'app');
const nodeExe = path.join(installDir, 'node', 'node.exe');
const address = 'http://127.0.0.1:3000';

function showError(message) {
  const dialog = spawn('wscript.exe', [path.join(installDir, 'message.vbs'), message], {
    windowsHide: true, detached: true, stdio: 'ignore',
  });
  dialog.on('error', () => {});
  dialog.unref();
}

async function portAvailable() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(3000, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function start() {
  if (!process.env.LOCALAPPDATA) throw new Error('Windows local application data directory is unavailable.');
  if (!(await portAvailable())) {
    throw new Error('Port 3000 is in use. Close the other application or existing AutoQuotes Free window and try again.');
  }
  const userData = path.join(process.env.LOCALAPPDATA, 'AutoQuotes Free');
  await mkdir(userData, { recursive: true });
  const browserDir = path.join(userData, 'browsers');
  await ensureBrowser(appDir, nodeExe, browserDir);
  const env = { ...process.env, AUTOQUOTES_DATA_DIR: userData, PLAYWRIGHT_BROWSERS_PATH: browserDir,
    AUTO_SHUTDOWN: '1', HOST: '127.0.0.1', PORT: '3000' };
  // Do not let a developer's DATABASE_PATH redirect an installed copy into
  // another project's database.
  delete env.DATABASE_PATH;
  const child = spawn(nodeExe, [path.join(appDir, 'dist', 'main.js')], {
    cwd: appDir,
    env,
    detached: true, windowsHide: true, stdio: 'ignore',
  });
  let failed = false;
  child.once('error', () => { failed = true; });
  child.once('exit', () => { failed = true; });
  for (let i = 0; i < 100 && !failed; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    try {
      const response = await fetch(`${address}/api/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok && !failed) {
        const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', address], {
          detached: true, windowsHide: true, stdio: 'ignore',
        });
        browser.on('error', () => showError(`Open ${address} in a browser to use AutoQuotes Free.`));
        browser.unref();
        child.unref();
        return;
      }
    } catch { /* The server may still be starting. */ }
  }
  if (!failed) child.kill();
  throw new Error('AutoQuotes Free could not start. Check that port 3000 is available and reinstall if needed.');
}

start().catch(error => showError(error.message || 'AutoQuotes Free could not start.'));
