import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('custom runtime directory contains the database, uploads, and exports', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autoquotes-data-'));
  process.env.AUTOQUOTES_DATA_DIR = root;
  delete process.env.DATABASE_PATH;
  const { createApp } = await import('../src/main.js');
  const { getDatabase, closeDatabase } = await import('../src/config/database.js');
  const { closePdfBrowser } = await import('../src/pdf/pdf-generator.js');
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  try {
    getDatabase();
    assert.ok(fs.existsSync(path.join(root, 'data', 'autoquote.db')));
    assert.ok(fs.existsSync(path.join(root, 'exports')));
    const form = new FormData();
    form.append('logo', new Blob(['fixture'], { type: 'image/png' }), 'fixture.png');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/settings/logo`, { method: 'POST', body: form });
    assert.equal(response.status, 200);
    const payload = await response.json() as { data: { logo_path: string } };
    assert.ok(fs.existsSync(path.join(root, 'uploads', path.basename(payload.data.logo_path))));
    const logo = await fetch(`http://127.0.0.1:${address.port}${payload.data.logo_path}`);
    assert.equal(await logo.text(), 'fixture');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await closePdfBrowser();
    closeDatabase();
    delete process.env.AUTOQUOTES_DATA_DIR;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
