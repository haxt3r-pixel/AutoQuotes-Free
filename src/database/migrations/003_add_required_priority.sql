-- 003_add_required_priority.sql: Add "required" to priority options plus transmission column
-- SQLite doesn't support ALTER COLUMN CHECK, so we recreate the table constraint.
-- Since the CHECK is only advisory (application enforces it too), we use a pragmatic approach:

-- Step 1: Create new table with updated CHECK
CREATE TABLE IF NOT EXISTS quote_line_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('part', 'labor', 'misc', 'fee', 'shipping')),
  description TEXT NOT NULL,
  priority TEXT DEFAULT NULL
    CHECK (priority IN ('safety_critical', 'required', 'recommended', 'optional') OR priority IS NULL),
  vendor TEXT,
  vendor_part_id TEXT,
  part_number TEXT,
  brand TEXT,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  markup_percent REAL NOT NULL DEFAULT 0,
  unit_price INTEGER NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 1,
  line_total INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_explanation TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Step 2: Copy data from old table
INSERT INTO quote_line_items_new
  SELECT * FROM quote_line_items;

-- Step 3: Drop old table
DROP TABLE quote_line_items;

-- Step 4: Rename new table
ALTER TABLE quote_line_items_new RENAME TO quote_line_items;

-- Step 5: Recreate indices
CREATE INDEX IF NOT EXISTS idx_line_items_quote ON quote_line_items(quote_id, sort_order);
