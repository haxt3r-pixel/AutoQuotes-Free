import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const progressScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'browser-progress.vbs');
const TIMEOUT_MS = 10 * 60 * 1000;

export function browserReady(appDir, browserDir) {
  try {
    const catalog = JSON.parse(readFileSync(path.join(appDir, 'node_modules', 'playwright-core', 'browsers.json'), 'utf8'));
    const revision = name => catalog.browsers.find(browser => browser.name === name)?.revision;
    const chromium = revision('chromium');
    const headless = revision('chromium-headless-shell');
    if (!chromium || !headless) return false;
    return existsSync(path.join(browserDir, `chromium-${chromium}`, 'chrome-win64', 'chrome.exe')) &&
      existsSync(path.join(browserDir, `chromium_headless_shell-${headless}`, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'));
  } catch { return false; }
}

export async function ensureBrowser(appDir, nodeExe, browserDir) {
  if (browserReady(appDir, browserDir)) return;
  const logFile = path.join(path.dirname(browserDir), 'logs', 'browser-setup.log');
  mkdirSync(path.dirname(logFile), { recursive: true });
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserDir };
  delete env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
  // Notify without blocking the launcher; it also dismisses itself after 15 seconds.
  const notice = spawn('wscript.exe', [progressScript], { detached: true, windowsHide: true, stdio: 'ignore' });
  notice.once('error', () => {});
  notice.unref();

  const log = openSync(logFile, 'w', 0o600);
  let exitCode;
  try {
    writeSync(log, 'Downloading browser dependencies for AutoQuotes Free.\n');
    // Execute Node directly; no shell parsing or detached PowerShell window is involved.
    const child = spawn(nodeExe, [path.join(appDir, 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium'], {
      cwd: appDir, env, windowsHide: true, stdio: ['ignore', log, log],
    });
    exitCode = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (child.pid) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
        reject(new Error(`Browser setup timed out. Check your internet connection and try again. Log: ${logFile}`));
      }, TIMEOUT_MS);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); resolve(code); });
    });
  } finally {
    closeSync(log);
  }
  if (exitCode !== 0) {
    throw new Error(`Browser setup failed (exit ${exitCode}). Check your internet connection and try again. Log: ${logFile}`);
  }
  if (!browserReady(appDir, browserDir)) {
    const logExists = existsSync(logFile);
    const browserDirectoryExists = existsSync(browserDir);
    throw new Error(`Browser setup completed but browser files were not found in ${browserDir}. Browser directory exists: ${browserDirectoryExists}; log exists: ${logExists}. Log: ${logFile}`);
  }
}

// Used by Windows CI to exercise the same first-run setup as the installed launcher.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [appDir, nodeExe, browserDir] = process.argv.slice(2);
  if (!appDir || !nodeExe || !browserDir) throw new Error('Expected app, Node executable, and browser directory.');
  await ensureBrowser(appDir, nodeExe, browserDir);
}
