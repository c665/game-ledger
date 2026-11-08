-- Revert wallet:ledger_table from pg

BEGIN;

DROP TABLE wallet.ledger;
DROP TYPE wallet.transaction_type;

COMMIT;
