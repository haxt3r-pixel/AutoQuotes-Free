import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

test('sent pricing survives approval and linked work protects financial history', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quote-history-'));
  process.env.DATABASE_PATH = path.join(dir, 'test.db');
  const { createApp } = await import('../src/main.js');
  const { closeDatabase } = await import('../src/config/database.js');
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  const base = `http://127.0.0.1:${address.port}/api`;
  async function request(method: string, url: string, body?: unknown) {
    const response = await fetch(base + url, {
      method, headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, json: await response.json() as any };
  }
  try {
    const created = await request('POST', '/quotes', { markup_override: 45 });
    const id = created.json.data.id;
    await request('POST', `/quotes/${id}/items`, { item_type: 'part', description: 'Part', unit_cost: 10000 });
    const quote = await request('GET', `/quotes/${id}`);
    assert.equal(quote.json.data.items[0].markup_percent, 45);
    assert.equal(quote.json.data.items[0].unit_price, 14500);
    await request('PUT', `/quotes/${id}`, { markup_override: 50 });
    assert.equal((await request('GET', `/quotes/${id}`)).json.data.items[0].unit_price, 15000);
    await request('PUT', `/quotes/${id}`, { tax_rate_override: 10 });
    const sent = await request('PUT', `/quotes/${id}/status`, { status: 'sent' });
    const sentTotal = sent.json.data.quote.grand_total;
    await request('PUT', '/settings', { shop_fee_percent: 20, disposal_fee: 900 });
    const approved = await request('PUT', `/quotes/${id}/status`, { status: 'approved' });
    assert.equal(approved.json.data.quote.grand_total, sentTotal);
    const jobId = approved.json.data.job.id;
    assert.equal((await request('GET', `/jobs/${jobId}`)).json.data.header.grand_total, sentTotal);
    assert.equal((await request('POST', `/quotes/${id}/recalculate`)).status, 409);
    assert.equal((await request('PUT', `/quotes/${id}/totals`, { grand_total: 1 })).status, 409);
    assert.equal((await request('POST', `/quotes/${id}/items`, { item_type: 'fee', description: 'extra', unit_cost: 1 })).status, 409);
    assert.equal((await request('DELETE', `/quotes/${id}?confirmed=true`)).status, 409);
    const completion = await request('POST', `/jobs/${jobId}/complete`, {});
    const ticketId = completion.json.data.ticket.id;
    await request('POST', `/billing/${ticketId}/pay`, {});
    assert.equal((await request('DELETE', `/jobs/${jobId}?confirmed=true`)).status, 409);
    assert.equal((await request('GET', `/billing/${ticketId}`)).json.data.status, 'paid');

    const draft = await request('POST', '/quotes', {});
    const draftId = draft.json.data.id;
    await request('POST', `/quotes/${draftId}/items`, { item_type: 'part', description: 'At cost', unit_cost: 10000, markup_percent: 0 });
    await request('PUT', `/quotes/${draftId}`, { markup_override: 50 });
    assert.equal((await request('GET', `/quotes/${draftId}`)).json.data.items[0].unit_price, 10000);
    const forged = await request('PUT', `/quotes/${draftId}/totals`, { grand_total: 1 });
    assert.notEqual(forged.json.data.grand_total, 1);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
