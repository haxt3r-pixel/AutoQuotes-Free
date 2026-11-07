-- Split customer addresses into structured fields while preserving legacy data.
ALTER TABLE customers ADD COLUMN address_street TEXT;
ALTER TABLE customers ADD COLUMN address_city TEXT;
ALTER TABLE customers ADD COLUMN address_state TEXT;
ALTER TABLE customers ADD COLUMN address_zip TEXT;

UPDATE customers
SET address_street = address
WHERE address IS NOT NULL AND trim(address) != '' AND address_street IS NULL;
