import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import partsRoutes, { isRockAutoUrl } from '../src/routes/parts.routes.js';

const valid = [
  'https://rockauto.com/en/catalog/',
  'https://www.rockauto.com/en/catalog/?id=1',
  'https://parts.rockauto.com/a',
  'https://ROCKAUTO.COM:443/a',
];
const invalid = [
  '', 'rockauto.com', 'http://rockauto.com/', 'https://rockauto.com.evil.test/',
  'https://notrockauto.com/', 'https://evil.test/rockauto.com/',
  'https://rockauto.com@evil.test/', 'https://user:password@rockauto.com/',
  'https://@rockauto.com/', 'https://rockauto.com:444/',
  'https://127.0.0.1/?rockauto.com', 'file:///tmp/rockauto.com',
  'https://rockauto.com\\@evil.test/', 'https://rockauto.com\n.evil.test/',
];

test('RockAuto URLs require HTTPS and an exact trusted domain without credentials or a nonstandard port', () => {
  for (const url of valid) assert.equal(isRockAutoUrl(url), true, url);
  for (const url of invalid) assert.equal(isRockAutoUrl(url), false, url);
  for (const value of [null, undefined, {}, 42]) assert.equal(isRockAutoUrl(value), false);
});

test('parts routes reject malicious listing URLs before launching a browser', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/parts', partsRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP address');
  const base = `http://127.0.0.1:${address.port}/api/parts`;
  try {
    const part = { part_number: 'fixture', listing_url: 'https://rockauto.com.evil.test/path', part_name: 'Fixture' };
    for (const [route, body] of [
      ['/shipping/checkout', { parts: [part], zipCode: '10001' }],
      ['/purchase', { parts: [part], zipCode: '10001' }],
      ['/checkout', { parts: [part] }],
      ['/cart/add', part],
      ['/shipping', { partName: 'Fixture', sourceUrl: part.listing_url }],
    ] as const) {
      const response = await fetch(base + route, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.equal(response.status, 400, route);
      assert.equal((await response.json() as { success: boolean }).success, false, route);
    }
    const mixed = await fetch(base + '/purchase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ ...part, listing_url: valid[0] }, part] }),
    });
    assert.equal(mixed.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
