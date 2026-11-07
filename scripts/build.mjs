import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Remove stale compiled files so releases include only the current source.
rmSync(path.join(root, 'dist'), { recursive: true, force: true });

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules', script), ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('typescript/bin/tsc', ['-p', 'frontend/tsconfig.json']);
run('vite/bin/vite.js', ['build']);
run('typescript/bin/tsc', ['-p', 'tsconfig.server.json']);

for (const [source, destination, extension] of [
  ['src/pdf/templates', 'dist/pdf/templates', '.html'],
  ['src/database/migrations', 'dist/database/migrations', '.sql'],
]) {
  const sourceDir = path.join(root, source);
  const destDir = path.join(root, destination);
  mkdirSync(destDir, { recursive: true });
  for (const file of readdirSync(sourceDir)) {
    if (file.endsWith(extension)) copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
  }
}
