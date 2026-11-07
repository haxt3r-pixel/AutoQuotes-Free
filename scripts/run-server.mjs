import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (!['dev', 'start', 'keep'].includes(mode)) {
  console.error('Usage: node scripts/run-server.mjs <dev|start|keep>');
  process.exit(1);
}

const args = mode === 'dev'
  ? [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'watch', 'src/main.ts']
  : [path.join(root, 'dist/main.js')];
const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, AUTO_SHUTDOWN: mode === 'start' ? '1' : '0' },
});
child.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
