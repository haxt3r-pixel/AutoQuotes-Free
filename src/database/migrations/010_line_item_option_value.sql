-- Preserve the selected vendor variant for shipping and purchasing after reload.
ALTER TABLE quote_line_items ADD COLUMN option_value TEXT;
