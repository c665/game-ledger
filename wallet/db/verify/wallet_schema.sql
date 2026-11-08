-- Verify wallet:wallet_schema on pg

BEGIN;

SELECT pg_catalog.has_schema_privilege('wallet', 'usage');

ROLLBACK;
