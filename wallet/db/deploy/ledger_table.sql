-- Deploy wallet:ledger_table to pg
-- requires: wallet_schema

BEGIN;

CREATE TYPE wallet.transaction_type AS ENUM ('credit', 'debit', 'rollback', 'adjustment');

-- Append-only ledger. Each row is one movement of money in one wallet,
-- a wallet being a (user_id, currency_code) pair, and stores the balance
-- after it. Amounts are signed, in minor units (cents): debits are negative,
-- credits positive, so balance = previous balance + amount.
CREATE TABLE wallet.ledger (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id uuid NOT NULL,
    currency_code varchar(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
    -- 1 for a wallet's first row, then +1 per row.
    version bigint NOT NULL CHECK (version >= 1),
    transaction_type wallet.transaction_type NOT NULL,
    amount bigint NOT NULL,
    balance bigint NOT NULL CHECK (balance >= 0),
    -- The row a rollback undoes.
    reference_id uuid REFERENCES wallet.ledger (id),
    -- The caller's transaction ID: the idempotency key.
    external_reference varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Two concurrent writes to one wallet can't both take the next version;
    -- the loser gets a unique violation and retries. The index also serves
    -- "latest row per wallet" and history queries.
    CONSTRAINT ledger_wallet_version_key UNIQUE (user_id, currency_code, version),
    -- A retried request finds its original row instead of moving money twice.
    CONSTRAINT ledger_external_reference_key UNIQUE (external_reference),
    -- A transaction can be rolled back at most once.
    CONSTRAINT ledger_reference_id_key UNIQUE (reference_id),

    CONSTRAINT ledger_amount_sign_check CHECK (
        (transaction_type = 'debit' AND amount < 0)
        OR (transaction_type = 'credit' AND amount > 0)
        OR (transaction_type IN ('rollback', 'adjustment') AND amount <> 0)
    ),
    -- Rollbacks must reference a row; nothing else may.
    CONSTRAINT ledger_rollback_reference_check CHECK (
        (transaction_type = 'rollback') = (reference_id IS NOT NULL)
    ),
    -- A wallet's first row starts from zero.
    CONSTRAINT ledger_first_balance_check CHECK (version > 1 OR balance = amount)
);

COMMIT;
