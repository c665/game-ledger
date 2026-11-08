-- Revert wallet:wallet_schema from pg

BEGIN;

DROP SCHEMA wallet;

COMMIT;
