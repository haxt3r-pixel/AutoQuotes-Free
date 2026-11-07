-- Older defaults stored these values as JSON strings instead of their actual
-- number/boolean types.
UPDATE settings SET value = '587'
WHERE key = 'smtp_port' AND value = '"587"';

UPDATE settings SET value = 'true'
WHERE key = 'smtp_secure' AND value = '"true"';

UPDATE settings SET value = 'false'
WHERE key = 'smtp_secure' AND value = '"false"';
