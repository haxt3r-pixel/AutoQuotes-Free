-- 005_add_line_item_source_url.sql: Persist the RockAuto listing URL on line items
-- so the "Purchase on RockAuto" flow can auto-add parts after a page reload.

ALTER TABLE quote_line_items ADD COLUMN source_url TEXT;
