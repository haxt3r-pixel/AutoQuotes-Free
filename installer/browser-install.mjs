import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const setupScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'browser-setup.ps1');
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
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browserDir };
  delete env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', setupScript,
    '-NodeExe', nodeExe, '-AppDir', appDir], { cwd: appDir, env, detached: true, windowsHide: false, stdio: 'ignore' });
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (child.pid) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      reject(new Error('Browser setup timed out. Check your internet connection and try again.'));
    }, TIMEOUT_MS);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); resolve(code); });
  });
  if (exitCode !== 0 || !browserReady(appDir, browserDir)) {
    throw new Error('Browser setup failed. Check your internet connection and try again.');
  }
}

// Used by Windows CI to exercise the same first-run setup as the installed launcher.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [appDir, nodeExe, browserDir] = process.argv.slice(2);
  if (!appDir || !nodeExe || !browserDir) throw new Error('Expected app, Node executable, and browser directory.');
  await ensureBrowser(appDir, nodeExe, browserDir);
}
