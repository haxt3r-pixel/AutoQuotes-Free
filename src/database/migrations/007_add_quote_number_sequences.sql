-- Allocate quote numbers independently of row count so deleting a quote cannot
-- cause a later quote number to collide with an existing one.
CREATE TABLE IF NOT EXISTS quote_number_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL CHECK (last_number >= 0)
);

INSERT INTO quote_number_sequences (year, last_number)
SELECT
  CAST(substr(quote_number, 3, 4) AS INTEGER),
  MAX(CAST(substr(quote_number, 8) AS INTEGER))
FROM quotes
WHERE quote_number GLOB 'Q-[0-9][0-9][0-9][0-9]-[0-9]*'
GROUP BY CAST(substr(quote_number, 3, 4) AS INTEGER)
ON CONFLICT(year) DO UPDATE SET
  last_number = MAX(last_number, excluded.last_number);
