import { getDatabase } from '../../config/database.js';
import { customersRepo } from './customers.repo.js';
import { quotesRepo } from './quotes.repo.js';

export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface JobHeader {
  id: number;
  job_number: string;
  quote_id: number;
  customer_id: number | null;
  vehicle_id: number | null;
  status: JobStatus;
  quote_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  vehicle_summary: string | null;
  vehicle_vin: string | null;
  vehicle_mileage: string | null;
  quote_notes: string | null;
  mechanic_notes: string | null;
  completion_notes: string | null;
  parts_subtotal: number;
  labor_subtotal: number;
  shop_fee_amount: number;
  misc_fees_total: number;
  tax_total: number;
  shipping_total: number;
  grand_total: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  billing_ticket_id?: number | null;
  billing_ticket_number?: string | null;
  billing_status?: BillingStatus | null;
  items_total?: number;
  items_done?: number;
}

export interface JobLineItem {
  id: number;
  job_id: number;
  source_line_item_id: number | null;
  item_type: 'part' | 'labor' | 'misc' | 'fee' | 'shipping';
  description: string;
  priority: 'safety_critical' | 'required' | 'recommended' | 'optional' | null;
  vendor: string | null;
  part_number: string | null;
  brand: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_done: number;
  mechanic_note: string | null;
  sort_order: number;
  created_at: string;
}

export interface FullJob {
  header: JobHeader;
  items: JobLineItem[];
}

function nextNumber(table: 'job_number_sequences' | 'billing_number_sequences', prefix: 'J' | 'B'): string {
  const db = getDatabase();
  const year = new Date().getFullYear();
  db.prepare(`
    INSERT INTO ${table} (year, last_number) VALUES (?, 1)
    ON CONFLICT(year) DO UPDATE SET last_number = last_number + 1
  `).run(year);
  const sequence = db.prepare(`SELECT last_number FROM ${table} WHERE year = ?`).get(year) as { last_number: number };
  return `${prefix}-${year}-${String(sequence.last_number).padStart(4, '0')}`;
}

function vehicleSummary(vehicle: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  submodel?: string | null;
  engine?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
} | null | undefined): string | null {
  if (!vehicle) return null;
  const parts = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.submodel,
    vehicle.engine,
    vehicle.drivetrain,
    vehicle.transmission,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

export class JobsRepository {
  getJobById(id: number): JobHeader | null {
    const db = getDatabase();
    return (db.prepare(`
      SELECT j.*,
        bt.id AS billing_ticket_id,
        bt.ticket_number AS billing_ticket_number,
        bt.status AS billing_status,
        (SELECT COUNT(*) FROM job_line_items i WHERE i.job_id = j.id) AS items_total,
        (SELECT COUNT(*) FROM job_line_items i WHERE i.job_id = j.id AND i.is_done = 1) AS items_done
      FROM jobs j
      LEFT JOIN billing_tickets bt ON bt.job_id = j.id
      WHERE j.id = ?
    `).get(id) as JobHeader | undefined) ?? null;
  }

  getJobByQuoteId(quoteId: number): JobHeader | null {
    const db = getDatabase();
    return (db.prepare(`
      SELECT j.*,
        bt.id AS billing_ticket_id,
        bt.ticket_number AS billing_ticket_number,
        bt.status AS billing_status
      FROM jobs j
      LEFT JOIN billing_tickets bt ON bt.job_id = j.id
      WHERE j.quote_id = ?
    `).get(quoteId) as JobHeader | undefined) ?? null;
  }

  getFullJob(id: number): FullJob | null {
    const header = this.getJobById(id);
    if (!header) return null;
    const db = getDatabase();
    const items = db.prepare(`
      SELECT * FROM job_line_items WHERE job_id = ? ORDER BY sort_order ASC, id ASC
    `).all(id) as JobLineItem[];
    return { header, items };
  }

  listJobs(status?: string, limit = 50, offset = 0, search?: string): JobHeader[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      if (status === 'void') {
        conditions.push("bt.status = 'void'");
      } else if (status === 'completed') {
        conditions.push("j.status = 'completed' AND COALESCE(bt.status, '') <> 'void'");
      } else {
        conditions.push('j.status = ?');
        params.push(status);
      }
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(`(
        j.job_number LIKE ? OR j.quote_number LIKE ? OR j.status LIKE ? OR COALESCE(bt.status, '') LIKE ?
        OR COALESCE(j.customer_name, '') LIKE ? OR COALESCE(j.vehicle_summary, '') LIKE ?
        OR COALESCE(j.mechanic_notes, '') LIKE ? OR COALESCE(j.completion_notes, '') LIKE ?
      )`);
      params.push(q, q, q, q, q, q, q, q);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    return db.prepare(`
      SELECT j.*,
        bt.id AS billing_ticket_id,
        bt.ticket_number AS billing_ticket_number,
        bt.status AS billing_status,
        (SELECT COUNT(*) FROM job_line_items i WHERE i.job_id = j.id) AS items_total,
        (SELECT COUNT(*) FROM job_line_items i WHERE i.job_id = j.id AND i.is_done = 1) AS items_done
      FROM jobs j
      LEFT JOIN billing_tickets bt ON bt.job_id = j.id
      ${where}
      ORDER BY
        CASE j.status
          WHEN 'in_progress' THEN 0
          WHEN 'open' THEN 1
          WHEN 'completed' THEN 2
          ELSE 3
        END,
        j.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params) as JobHeader[];
  }

  /**
   * Create a job snapshot from an approved quote.
   * Idempotent: returns existing job if one already exists for the quote.
   */
  createJobFromQuote(quoteId: number): FullJob {
    const existing = this.getJobByQuoteId(quoteId);
    if (existing) {
      return this.getFullJob(existing.id)!;
    }

    const fullQuote = quotesRepo.getFullQuote(quoteId);
    if (!fullQuote) throw new Error(`Quote #${quoteId} not found`);
    const { header, items } = fullQuote;

    const customer = header.customer_id ? customersRepo.getCustomerById(header.customer_id) : null;
    const vehicle = header.vehicle_id ? customersRepo.getVehicleById(header.vehicle_id) : null;

    const db = getDatabase();
    return db.transaction(() => {
      const jobNumber = nextNumber('job_number_sequences', 'J');
      const result = db.prepare(`
        INSERT INTO jobs (
          job_number, quote_id, customer_id, vehicle_id, status,
          quote_number, customer_name, customer_phone, customer_email,
          vehicle_summary, vehicle_vin, vehicle_mileage, quote_notes,
          parts_subtotal, labor_subtotal, shop_fee_amount, misc_fees_total,
          tax_total, shipping_total, grand_total, started_at
        ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        jobNumber,
        quoteId,
        header.customer_id,
        header.vehicle_id,
        header.quote_number,
        customer?.name ?? null,
        customer?.phone ?? null,
        customer?.email ?? null,
        vehicleSummary(vehicle as any),
        vehicle?.vin ?? null,
        vehicle?.mileage != null ? String(vehicle.mileage) : null,
        header.notes,
        header.parts_subtotal,
        header.labor_subtotal,
        header.shop_fee_amount,
        header.misc_fees_total,
        header.tax_total,
        header.shipping_total,
        header.grand_total,
      );

      const jobId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO job_line_items (
          job_id, source_line_item_id, item_type, description, priority,
          vendor, part_number, brand, quantity, unit_price, line_total, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(
          jobId,
          item.id,
          item.item_type,
          item.description,
          item.priority,
          item.vendor,
          item.part_number,
          item.brand,
          item.quantity,
          item.unit_price,
          item.line_total,
          item.sort_order,
        );
      }

      return this.getFullJob(jobId)!;
    })();
  }

  updateJob(id: number, data: {
    status?: JobStatus;
    mechanic_notes?: string | null;
    completion_notes?: string | null;
  }): JobHeader | null {
    const current = this.getJobById(id);
    if (!current) return null;
    if (current.status === 'completed' || current.status === 'cancelled') {
      // Allow notes edits only on closed jobs
      if (data.status && data.status !== current.status) {
        throw new Error(`Cannot change status of a ${current.status} job`);
      }
    }

    const db = getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.mechanic_notes !== undefined) {
      fields.push('mechanic_notes = ?');
      values.push(data.mechanic_notes);
    }
    if (data.completion_notes !== undefined) {
      fields.push('completion_notes = ?');
      values.push(data.completion_notes);
    }
    if (data.status !== undefined && data.status !== current.status) {
      if (data.status === 'completed') {
        throw new Error('Use completeJob() to finish a job and open billing');
      }
      fields.push('status = ?');
      values.push(data.status);
      if (data.status === 'in_progress' && !current.started_at) {
        fields.push("started_at = datetime('now')");
      }
    }

    if (fields.length === 0) return current;
    fields.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getJobById(id);
  }

  deleteJob(id: number): boolean {
    const db = getDatabase();
    return db.transaction(() => {
      if (db.prepare('SELECT 1 FROM billing_tickets WHERE job_id = ?').get(id)) {
        throw new Error('Cannot delete a job with a linked billing ticket');
      }
      return db.prepare('DELETE FROM jobs WHERE id = ?').run(id).changes > 0;
    })();
  }

  updateJobItem(jobId: number, itemId: number, data: {
    is_done?: boolean;
    mechanic_note?: string | null;
  }): JobLineItem | null {
    const job = this.getJobById(jobId);
    if (!job) return null;
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new Error('Cannot update items on a closed job');
    }

    const db = getDatabase();
    const item = db.prepare(
      'SELECT * FROM job_line_items WHERE id = ? AND job_id = ?',
    ).get(itemId, jobId) as JobLineItem | undefined;
    if (!item) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.is_done !== undefined) {
      fields.push('is_done = ?');
      values.push(data.is_done ? 1 : 0);
    }
    if (data.mechanic_note !== undefined) {
      fields.push('mechanic_note = ?');
      values.push(data.mechanic_note);
    }
    if (fields.length === 0) return item;
    values.push(itemId, jobId);
    db.prepare(`UPDATE job_line_items SET ${fields.join(', ')} WHERE id = ? AND job_id = ?`).run(...values);

    // Auto-promote open → in_progress when first item is checked
    if (data.is_done && job.status === 'open') {
      db.prepare(`
        UPDATE jobs SET status = 'in_progress',
          started_at = COALESCE(started_at, datetime('now')),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(jobId);
    }

    db.prepare("UPDATE jobs SET updated_at = datetime('now') WHERE id = ?").run(jobId);
    return db.prepare('SELECT * FROM job_line_items WHERE id = ?').get(itemId) as JobLineItem;
  }

  /**
   * Complete the job and create an open billing ticket.
   * Idempotent if already completed with a ticket.
   */
  completeJob(id: number, completionNotes?: string | null): {
    job: FullJob;
    ticket: BillingTicket;
  } {
    const job = this.getJobById(id);
    if (!job) throw new Error(`Job #${id} not found`);
    if (job.status === 'cancelled') throw new Error('Cannot complete a cancelled job');

    const db = getDatabase();
    return db.transaction(() => {
      if (job.status !== 'completed') {
        db.prepare(`
          UPDATE jobs SET
            status = 'completed',
            completion_notes = COALESCE(?, completion_notes),
            completed_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        `).run(completionNotes ?? null, id);
      } else if (completionNotes !== undefined) {
        db.prepare(`
          UPDATE jobs SET completion_notes = ?, updated_at = datetime('now') WHERE id = ?
        `).run(completionNotes, id);
      }

      let ticket = billingRepo.getTicketByJobId(id);
      if (!ticket) {
        ticket = billingRepo.createTicketFromJob(id);
      }

      return {
        job: this.getFullJob(id)!,
        ticket,
      };
    })();
  }
}

export type BillingStatus = 'open' | 'paid' | 'void';

export interface BillingTicket {
  id: number;
  ticket_number: string;
  job_id: number;
  quote_id: number;
  customer_id: number | null;
  status: BillingStatus;
  amount_due_cents: number;
  amount_paid_cents: number;
  paid_in_full: number;
  paid_at: string | null;
  payment_note: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle_summary: string | null;
  job_number: string;
  quote_number: string;
  created_at: string;
  closed_at: string | null;
  updated_at: string;
}

export class BillingRepository {
  getTicketById(id: number): BillingTicket | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM billing_tickets WHERE id = ?').get(id) as BillingTicket | undefined) ?? null;
  }

  getTicketByJobId(jobId: number): BillingTicket | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM billing_tickets WHERE job_id = ?').get(jobId) as BillingTicket | undefined) ?? null;
  }

  listTickets(status?: string, limit = 50, offset = 0, search?: string): BillingTicket[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(`(
        ticket_number LIKE ? OR job_number LIKE ? OR quote_number LIKE ? OR status LIKE ?
        OR COALESCE(customer_name, '') LIKE ? OR COALESCE(vehicle_summary, '') LIKE ?
        OR COALESCE(payment_note, '') LIKE ?
      )`);
      params.push(q, q, q, q, q, q, q);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    return db.prepare(`
      SELECT * FROM billing_tickets
      ${where}
      ORDER BY
        CASE status WHEN 'open' THEN 0 WHEN 'paid' THEN 1 ELSE 2 END,
        updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params) as BillingTicket[];
  }

  createTicketFromJob(jobId: number): BillingTicket {
    const existing = this.getTicketByJobId(jobId);
    if (existing) return existing;

    const job = jobsRepo.getJobById(jobId);
    if (!job) throw new Error(`Job #${jobId} not found`);
    if (job.status !== 'completed') {
      throw new Error('Billing tickets can only be created from completed jobs');
    }

    const db = getDatabase();
    const ticketNumber = nextNumber('billing_number_sequences', 'B');
    const result = db.prepare(`
      INSERT INTO billing_tickets (
        ticket_number, job_id, quote_id, customer_id, status,
        amount_due_cents, amount_paid_cents, paid_in_full,
        customer_name, customer_phone, vehicle_summary, job_number, quote_number
      ) VALUES (?, ?, ?, ?, 'open', ?, 0, 0, ?, ?, ?, ?, ?)
    `).run(
      ticketNumber,
      job.id,
      job.quote_id,
      job.customer_id,
      job.grand_total,
      job.customer_name,
      job.customer_phone,
      job.vehicle_summary,
      job.job_number,
      job.quote_number,
    );
    return this.getTicketById(Number(result.lastInsertRowid))!;
  }

  markPaid(id: number, paymentNote?: string | null): BillingTicket {
    const ticket = this.getTicketById(id);
    if (!ticket) throw new Error(`Billing ticket #${id} not found`);
    if (ticket.status === 'void') throw new Error('Cannot pay a void ticket');
    if (ticket.status === 'paid' && ticket.paid_in_full) return ticket;

    const db = getDatabase();
    db.prepare(`
      UPDATE billing_tickets SET
        status = 'paid',
        amount_paid_cents = amount_due_cents,
        paid_in_full = 1,
        paid_at = datetime('now'),
        closed_at = datetime('now'),
        payment_note = COALESCE(?, payment_note),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(paymentNote ?? null, id);
    return this.getTicketById(id)!;
  }

  voidTicket(id: number, paymentNote?: string | null): BillingTicket {
    const ticket = this.getTicketById(id);
    if (!ticket) throw new Error(`Billing ticket #${id} not found`);
    if (ticket.status === 'paid') throw new Error('Cannot void a paid ticket');

    const db = getDatabase();
    db.prepare(`
      UPDATE billing_tickets SET
        status = 'void',
        closed_at = datetime('now'),
        payment_note = COALESCE(?, payment_note),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(paymentNote ?? null, id);
    return this.getTicketById(id)!;
  }
}

export const jobsRepo = new JobsRepository();
export const billingRepo = new BillingRepository();
