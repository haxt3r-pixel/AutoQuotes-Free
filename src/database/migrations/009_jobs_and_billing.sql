-- Job management + off-app billing tickets
-- Flow: approved quote → open job → complete job → billing ticket → mark paid

CREATE TABLE IF NOT EXISTS job_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL CHECK (last_number >= 0)
);

CREATE TABLE IF NOT EXISTS billing_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL CHECK (last_number >= 0)
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_number TEXT UNIQUE NOT NULL,
  quote_id INTEGER NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE RESTRICT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  -- Snapshots for mechanic-friendly offline-ish viewing
  quote_number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  vehicle_summary TEXT,
  vehicle_vin TEXT,
  vehicle_mileage TEXT,
  quote_notes TEXT,
  mechanic_notes TEXT,
  completion_notes TEXT,
  parts_subtotal INTEGER NOT NULL DEFAULT 0,
  labor_subtotal INTEGER NOT NULL DEFAULT 0,
  shop_fee_amount INTEGER NOT NULL DEFAULT 0,
  misc_fees_total INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  shipping_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quote ON jobs(quote_id);

CREATE TABLE IF NOT EXISTS job_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  source_line_item_id INTEGER,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('part', 'labor', 'misc', 'fee', 'shipping')),
  description TEXT NOT NULL,
  priority TEXT DEFAULT NULL
    CHECK (priority IN ('safety_critical', 'required', 'recommended', 'optional') OR priority IS NULL),
  vendor TEXT,
  part_number TEXT,
  brand TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL DEFAULT 0,
  is_done INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  mechanic_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_job_items_job ON job_line_items(job_id, sort_order);

CREATE TABLE IF NOT EXISTS billing_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT UNIQUE NOT NULL,
  job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE RESTRICT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paid', 'void')),
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  paid_in_full INTEGER NOT NULL DEFAULT 0 CHECK (paid_in_full IN (0, 1)),
  paid_at TEXT,
  payment_note TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  vehicle_summary TEXT,
  job_number TEXT NOT NULL,
  quote_number TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  closed_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_billing_status ON billing_tickets(status);
CREATE INDEX IF NOT EXISTS idx_billing_customer ON billing_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_job ON billing_tickets(job_id);
