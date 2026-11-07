import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('customer vehicle details and vendor variant survive database reload', async () => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoquote-variant-'));
  process.env.DATABASE_PATH = path.join(scratchDir, 'test.db');
  const { customersRepo } = await import('../src/database/repositories/customers.repo.js');
  const { quotesRepo } = await import('../src/database/repositories/quotes.repo.js');
  const { closeDatabase } = await import('../src/config/database.js');
  try {
    const customer = customersRepo.createCustomer({ name: 'Temporary Customer' });
    const vehicle = customersRepo.createVehicle({ customer_id: customer.id, submodel: 'Sport', drivetrain: 'AWD' });
    assert.equal(vehicle.submodel, 'Sport');
    assert.equal(vehicle.drivetrain, 'AWD');
    const quote = quotesRepo.createQuote({ customer_id: customer.id, vehicle_id: vehicle.id });
    const item = quotesRepo.addLineItem(quote.id, {
      item_type: 'part', description: 'Variant', source_url: 'https://www.rockauto.com/example', option_value: 'size-large',
    });
    assert.equal(quotesRepo.getLineItemById(item.id)?.option_value, 'size-large');
    assert.equal(quotesRepo.getLineItemById(item.id)?.source_url, 'https://www.rockauto.com/example');
  } finally {
    closeDatabase();
    delete process.env.DATABASE_PATH;
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
});
