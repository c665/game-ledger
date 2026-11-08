import { DatabaseError, type Pool } from "pg";
import type {
  AppendFailure,
  LedgerEntry,
  LedgerRepository,
} from "./ledger-repository.ts";

const UNIQUE_VIOLATION = "23505";

// The unique constraints on wallet.ledger, by name, and what each one means.
const APPEND_FAILURES: Record<string, AppendFailure> = {
  ledger_wallet_version_key: "version_conflict",
  ledger_external_reference_key: "duplicate_external_reference",
  ledger_reference_id_key: "already_rolled_back",
};

const COLUMNS = [
  "id",
  'user_id AS "userId"',
  'currency_code AS "currencyCode"',
  "version",
  'transaction_type AS "transactionType"',
  "amount",
  "balance",
  'reference_id AS "referenceId"',
  'external_reference AS "externalReference"',
  'created_at AS "createdAt"',
].join(", ");

export const createPgLedgerRepository = (pool: Pool): LedgerRepository => ({
  findLatest: async (userId, currencyCode) => {
    const query = `
      SELECT 
        ${COLUMNS}
      FROM wallet.ledger
      WHERE user_id = $1 AND currency_code = $2
      ORDER BY version DESC
      LIMIT 1;
    `;

    const result = await pool.query<LedgerEntry>(query, [userId, currencyCode]);

    return result.rows[0] ?? null;
  },

  findByExternalReference: async (externalReference) => {
    const query = `
      SELECT 
        ${COLUMNS}
      FROM wallet.ledger
      WHERE external_reference = $1;
    `;

    const result = await pool.query<LedgerEntry>(query, [externalReference]);

    return result.rows[0] ?? null;
  },

  append: async (entry) => {
    const {
      userId,
      currencyCode,
      version,
      transactionType,
      amount,
      balance,
      referenceId,
      externalReference,
    } = entry;

    const query = `
      INSERT INTO wallet.ledger (
        user_id,
        currency_code,
        version,
        transaction_type,
        amount,
        balance,
        reference_id,
        external_reference
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING ${COLUMNS};
    `;

    try {
      const result = await pool.query<LedgerEntry>(query, [
        userId,
        currencyCode,
        version,
        transactionType,
        amount,
        balance,
        referenceId,
        externalReference,
      ]);

      const inserted = result.rows[0];

      if (!inserted) {
        throw new Error("INSERT ... RETURNING returned no row");
      }

      return { ok: true, entry: inserted };
    } catch (error) {
      // Only the named unique violations are outcomes the caller handles.
      // Anything else (check or foreign key violations, connection errors)
      // is a bug or an outage.
      if (!(error instanceof DatabaseError)) {
        throw error;
      }

      if (error.code !== UNIQUE_VIOLATION || !error.constraint) {
        throw error;
      }

      const reason = APPEND_FAILURES[error.constraint];

      if (!reason) {
        throw error;
      }

      return { ok: false, reason };
    }
  },
});
