-- Verify wallet:ledger_table on pg

BEGIN;

SELECT pg_catalog.has_type_privilege('wallet.transaction_type', 'usage');

SELECT
    id,
    user_id,
    currency_code,
    version,
    transaction_type,
    amount,
    balance,
    reference_id,
    external_reference,
    created_at
FROM wallet.ledger
WHERE false;

ROLLBACK;
