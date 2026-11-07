import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('quote numbering survives deletion and line-item mutations enforce ownership', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoquote-integrity-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');

  const { quotesRepo } = await import('../src/database/repositories/quotes.repo.js');
  const { jobsRepo, billingRepo } = await import('../src/database/repositories/jobs.repo.js');
  const { getDatabase } = await import('../src/config/database.js');

  try {
    const quotes = Array.from({ length: 5 }, () => quotesRepo.createQuote());
    quotesRepo.deleteQuote(quotes[3].id);

    const next = quotesRepo.createQuote();
    const year = new Date().getFullYear();
    assert.equal(next.quote_number, `Q-${year}-0006`);

    const item = quotesRepo.addLineItem(quotes[0].id, {
      item_type: 'part',
      description: 'Brake pad set',
      unit_cost: 5000,
    });

    assert.equal(
      quotesRepo.updateLineItem(quotes[1].id, item.id, { description: 'Wrong quote' }),
      false,
    );
    assert.equal(quotesRepo.deleteLineItem(quotes[1].id, item.id), false);
    assert.equal(
      quotesRepo.updateLineItemPriority(quotes[1].id, item.id, 'required'),
      false,
    );
    assert.equal(
      quotesRepo.updateLineItemExplanation(quotes[1].id, item.id, 'Wrong quote'),
      false,
    );
    assert.equal(quotesRepo.getLineItemById(item.id)?.description, 'Brake pad set');

    assert.equal(
      quotesRepo.updateLineItem(quotes[0].id, item.id, { description: 'Front brake pad set' }),
      true,
    );
    assert.equal(quotesRepo.getLineItemById(item.id)?.description, 'Front brake pad set');

    const approved = quotesRepo.createQuote();
    quotesRepo.updateQuoteStatus(approved.id, 'approved');
    const job = jobsRepo.createJobFromQuote(approved.id);
    const completed = jobsRepo.completeJob(job.header.id);

    assert.throws(() => quotesRepo.deleteQuote(approved.id), /linked job or billing ticket/);
    assert.ok(quotesRepo.getQuoteById(approved.id));
    assert.ok(jobsRepo.getJobById(job.header.id));
    assert.ok(billingRepo.getTicketById(completed.ticket.id));
  } finally {
    getDatabase().close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
