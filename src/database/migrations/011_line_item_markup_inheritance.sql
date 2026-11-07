-- Existing markups are retained as explicit because their original intent is unknown.
ALTER TABLE quote_line_items ADD COLUMN markup_inherited INTEGER NOT NULL DEFAULT 0 CHECK (markup_inherited IN (0, 1));
