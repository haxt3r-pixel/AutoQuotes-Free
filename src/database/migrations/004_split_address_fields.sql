-- 004_split_address_fields.sql: Split shop address into street/city/state/zip
ALTER TABLE shop_profile ADD COLUMN address_street TEXT;
ALTER TABLE shop_profile ADD COLUMN address_city TEXT;
ALTER TABLE shop_profile ADD COLUMN address_state TEXT;
ALTER TABLE shop_profile ADD COLUMN address_zip TEXT;

-- Migrate existing single-line address into street (best effort)
-- If the old address has commas, split it
UPDATE shop_profile
SET address_street = CASE
  WHEN instr(address, ',') > 0 THEN trim(substr(address, 1, instr(address, ',') - 1))
  ELSE address
END,
address_city = CASE
  WHEN instr(address, ',') > 0 THEN
    trim(substr(address, instr(address, ',') + 1,
      CASE WHEN instr(substr(address, instr(address, ',') + 1), ',') > 0
        THEN instr(substr(address, instr(address, ',') + 1), ',') - 1
        ELSE length(address)
      END
    ))
  ELSE NULL
END,
address_state = CASE
  WHEN length(address) - length(replace(address, ',', '')) >= 2 THEN
    trim(replace(substr(address, instr(address, ',') + 1), rtrim(rtrim(substr(address, instr(address, ',') + 1), '0123456789 -'), ','), ''))
  ELSE NULL
END,
address_zip = CASE
  WHEN address GLOB '*[0-9][0-9][0-9][0-9][0-9]' THEN
    trim(substr(address, length(address) - 4))
  ELSE NULL
END
WHERE address IS NOT NULL AND address != '';
