-- 002_add_vehicle_fields.sql: Add submodel, drivetrain to vehicles table

ALTER TABLE vehicles ADD COLUMN submodel TEXT;
ALTER TABLE vehicles ADD COLUMN drivetrain TEXT;
