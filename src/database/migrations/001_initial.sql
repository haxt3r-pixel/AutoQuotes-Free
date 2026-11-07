-- 001_initial.sql: Core schema for Auto Repair Quote Application

-- Singleton shop profile
CREATE TABLE IF NOT EXISTS shop_profile (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name TEXT NOT NULL DEFAULT 'My Auto Repair Shop',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_path TEXT
);
INSERT OR IGNORE INTO shop_profile (id) VALUES (1);

-- Key-value settings (JSON values)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  vin TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  engine TEXT,
  transmission TEXT,
  mileage INTEGER,
  license_plate TEXT,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Quotes (header)
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved', 'declined', 'expired')),
  notes TEXT,
  valid_until TEXT,

  -- Per-quote overrides (NULL = use global default)
  labor_rate_override INTEGER,     -- cents/hour
  tax_rate_override REAL,
  shop_fee_override REAL,
  markup_override REAL,

  -- Computed totals (stored for consistency, in cents)
  parts_subtotal INTEGER NOT NULL DEFAULT 0,
  labor_subtotal INTEGER NOT NULL DEFAULT 0,
  shop_fee_amount INTEGER NOT NULL DEFAULT 0,
  misc_fees_total INTEGER NOT NULL DEFAULT 0,
  tax_total INTEGER NOT NULL DEFAULT 0,
  shipping_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Quote line items
CREATE TABLE IF NOT EXISTS quote_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('part', 'labor', 'misc', 'fee', 'shipping')),
  description TEXT NOT NULL,
  priority TEXT DEFAULT NULL
    CHECK (priority IN ('safety_critical', 'recommended', 'optional') OR priority IS NULL),

  -- Part-specific fields
  vendor TEXT,
  vendor_part_id TEXT,
  part_number TEXT,
  brand TEXT,

  -- Pricing (in cents)
  unit_cost INTEGER NOT NULL DEFAULT 0,
  markup_percent REAL NOT NULL DEFAULT 0,
  unit_price INTEGER NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 1,    -- hours for labor, qty for parts
  line_total INTEGER NOT NULL DEFAULT 0,

  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_explanation TEXT,                -- cached AI explanation
  created_at TEXT DEFAULT (datetime('now'))
);

-- Vendor parts cache (reduces repeat scraping)
CREATE TABLE IF NOT EXISTS parts_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor TEXT NOT NULL,
  vendor_part_id TEXT NOT NULL,
  search_keyword TEXT,
  data TEXT NOT NULL,                  -- JSON blob
  cached_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,                     -- TTL for cache entries
  UNIQUE(vendor, vendor_part_id)
);

CREATE INDEX IF NOT EXISTS idx_parts_cache_vendor ON parts_cache(vendor, vendor_part_id);
CREATE INDEX IF NOT EXISTS idx_parts_cache_search ON parts_cache(vendor, search_keyword);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_line_items_quote ON quote_line_items(quote_id, sort_order);