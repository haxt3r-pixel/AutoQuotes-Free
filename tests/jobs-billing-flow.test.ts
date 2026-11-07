import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('approved quote creates job, complete opens billing, mark paid closes ticket', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoquote-jobs-'));
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');

  const { quotesRepo } = await import('../src/database/repositories/quotes.repo.js');
  const { customersRepo } = await import('../src/database/repositories/customers.repo.js');
  const { jobsRepo, billingRepo } = await import('../src/database/repositories/jobs.repo.js');
  const { getDatabase } = await import('../src/config/database.js');

  try {
    const customer = customersRepo.createCustomer({
      name: 'Jane Driver',
      phone: '555-0100',
      email: 'jane@example.com',
    });
    const vehicle = customersRepo.createVehicle({
      customer_id: customer.id,
      year: 2018,
      make: 'Toyota',
      model: 'Camry',
      vin: '1HGBH41JXMN109186',
      mileage: 92000,
    });

    const quote = quotesRepo.createQuote({
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      notes: 'Customer hears grinding on braking',
    });

    quotesRepo.addLineItem(quote.id, {
      item_type: 'part',
      description: 'Front brake pads',
      unit_cost: 4500,
      quantity: 1,
      markup_percent: 30,
    });
    quotesRepo.addLineItem(quote.id, {
      item_type: 'labor',
      description: 'Replace front pads',
      unit_cost: 12000,
      quantity: 1,
      markup_percent: 0,
    });

    const recalculated = quotesRepo.recalculateTotals(quote.id);
    assert.ok(recalculated);
    assert.ok(recalculated.header.grand_total > 0);

    // Creating a job before approval is allowed by repo but routes require approved;
    // flow under test: approve then create (idempotent).
    quotesRepo.updateQuoteStatus(quote.id, 'approved');

    const job1 = jobsRepo.createJobFromQuote(quote.id);
    assert.equal(job1.header.status, 'open');
    assert.match(job1.header.job_number, /^J-\d{4}-\d{4}$/);
    assert.equal(job1.header.customer_name, 'Jane Driver');
    assert.ok(job1.header.vehicle_summary?.includes('Camry'));
    assert.equal(job1.items.length, 2);
    assert.equal(job1.header.grand_total, recalculated.header.grand_total);

    // Idempotent create
    const job2 = jobsRepo.createJobFromQuote(quote.id);
    assert.equal(job2.header.id, job1.header.id);
    assert.equal(job2.header.job_number, job1.header.job_number);

    // Checklist: first done promotes to in_progress
    const itemId = job1.items[0].id;
    const updatedItem = jobsRepo.updateJobItem(job1.header.id, itemId, {
      is_done: true,
      mechanic_note: 'Pads were metal-on-metal',
    });
    assert.ok(updatedItem);
    assert.equal(updatedItem.is_done, 1);
    const afterCheck = jobsRepo.getJobById(job1.header.id)!;
    assert.equal(afterCheck.status, 'in_progress');
    assert.ok(afterCheck.started_at);

    jobsRepo.updateJob(job1.header.id, {
      mechanic_notes: 'Rotors still in spec',
    });

    const { job: completed, ticket } = jobsRepo.completeJob(
      job1.header.id,
      'Road tested — no grind',
    );
    assert.equal(completed.header.status, 'completed');
    assert.equal(completed.header.completion_notes, 'Road tested — no grind');
    assert.ok(completed.header.completed_at);
    assert.match(ticket.ticket_number, /^B-\d{4}-\d{4}$/);
    assert.equal(ticket.status, 'open');
    assert.equal(ticket.amount_due_cents, completed.header.grand_total);
    assert.equal(ticket.paid_in_full, 0);

    // complete again is idempotent
    const again = jobsRepo.completeJob(job1.header.id);
    assert.equal(again.ticket.id, ticket.id);

    const paid = billingRepo.markPaid(ticket.id, 'Cash — drawer A');
    assert.equal(paid.status, 'paid');
    assert.equal(paid.paid_in_full, 1);
    assert.equal(paid.amount_paid_cents, paid.amount_due_cents);
    assert.ok(paid.paid_at);
    assert.ok(paid.closed_at);
    assert.equal(paid.payment_note, 'Cash — drawer A');

    // paid again is idempotent
    const paid2 = billingRepo.markPaid(ticket.id);
    assert.equal(paid2.id, paid.id);
    assert.equal(paid2.status, 'paid');

    // cannot void paid
    assert.throws(() => billingRepo.voidTicket(ticket.id), /Cannot void a paid ticket/);

    // cannot complete cancelled
    const quoteB = quotesRepo.createQuote();
    quotesRepo.updateQuoteStatus(quoteB.id, 'approved');
    const jobB = jobsRepo.createJobFromQuote(quoteB.id);
    jobsRepo.updateJob(jobB.header.id, { status: 'cancelled' });
    assert.throws(() => jobsRepo.completeJob(jobB.header.id), /cancelled/i);

    // lists work
    const openJobs = jobsRepo.listJobs('in_progress');
    assert.equal(openJobs.filter(j => j.id === job1.header.id).length, 0);
    const completedJobs = jobsRepo.listJobs('completed');
    assert.ok(completedJobs.some(j => j.id === job1.header.id));
    const openTickets = billingRepo.listTickets('open');
    assert.equal(openTickets.filter(t => t.id === ticket.id).length, 0);
    const paidTickets = billingRepo.listTickets('paid');
    assert.ok(paidTickets.some(t => t.id === ticket.id));

    // Voided billing is reflected as the job's effective list/detail status.
    const quoteC = quotesRepo.createQuote();
    quotesRepo.updateQuoteStatus(quoteC.id, 'approved');
    const jobC = jobsRepo.createJobFromQuote(quoteC.id);
    const completedC = jobsRepo.completeJob(jobC.header.id);
    billingRepo.voidTicket(completedC.ticket.id);

    assert.equal(jobsRepo.getJobById(jobC.header.id)?.billing_status, 'void');
    assert.ok(jobsRepo.listJobs('void').some(j => j.id === jobC.header.id));
    assert.equal(jobsRepo.listJobs('completed').some(j => j.id === jobC.header.id), false);

    assert.throws(() => jobsRepo.deleteJob(jobC.header.id), /linked billing ticket/);
    assert.ok(jobsRepo.getJobById(jobC.header.id));
    assert.ok(billingRepo.getTicketById(completedC.ticket.id));
  } finally {
    getDatabase().close();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  }
});
