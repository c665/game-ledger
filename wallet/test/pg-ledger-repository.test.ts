import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { Pool } from "pg";
import { createDbPool } from "../src/db/create-db-pool.ts";
import type {
  LedgerRepository,
  NewLedgerEntry,
} from "../src/repository/ledger-repository.ts";
import { createPgLedgerRepository } from "../src/repository/pg-ledger-repository.ts";

// Runs against the real database: `docker compose up -d --wait` and
// `npm run db:deploy` first.

const newEntry = (overrides: Partial<NewLedgerEntry> = {}): NewLedgerEntry => ({
  userId: randomUUID(),
  currencyCode: "EUR",
  version: 1n,
  transactionType: "credit",
  amount: 100n,
  balance: 100n,
  referenceId: null,
  externalReference: randomUUID(),
  ...overrides,
});

describe("pg ledger repository", () => {
  let pool: Pool;
  let repo: LedgerRepository;

  before(() => {
    pool = createDbPool();
    repo = createPgLedgerRepository(pool);
  });

  after(async () => {
    await pool.end();
  });

  it("appends an entry and finds it as the wallet's latest", async () => {
    const entry = newEntry();

    const result = await repo.append(entry);
    assert.ok(result.ok);

    const latest = await repo.findLatest(entry.userId, entry.currencyCode);
    assert.deepEqual(latest, result.entry);
  });

  // Appends an entry that must succeed, and returns the stored row.
  const appendOk = async (entry: NewLedgerEntry) => {
    const result = await repo.append(entry);
    assert.ok(result.ok, `append failed: ${!result.ok && result.reason}`);
    return result.entry;
  };

  it("findLatest returns null for a wallet with no entries", async () => {
    assert.equal(await repo.findLatest(randomUUID(), "EUR"), null);
  });

  it("findLatest returns the highest version of that wallet only", async () => {
    const first = await appendOk(newEntry());
    const { userId } = first;
    const second = await appendOk(
      newEntry({
        userId,
        version: 2n,
        transactionType: "debit",
        amount: -30n,
        balance: 70n,
      }),
    );
    // Same user, other currency: a separate wallet.
    await appendOk(
      newEntry({ userId, currencyCode: "USD", amount: 5n, balance: 5n }),
    );

    assert.deepEqual(await repo.findLatest(userId, "EUR"), second);
  });

  it("findByExternalReference returns the entry, or null", async () => {
    const entry = await appendOk(newEntry());

    assert.deepEqual(
      await repo.findByExternalReference(entry.externalReference),
      entry,
    );
    assert.equal(await repo.findByExternalReference(randomUUID()), null);
  });

  it("append reports version_conflict", async () => {
    const { userId } = await appendOk(newEntry());

    const result = await repo.append(newEntry({ userId }));

    assert.deepEqual(result, { ok: false, reason: "version_conflict" });
  });

  it("append reports duplicate_external_reference", async () => {
    const { externalReference } = await appendOk(newEntry());

    const result = await repo.append(newEntry({ externalReference }));

    assert.deepEqual(result, {
      ok: false,
      reason: "duplicate_external_reference",
    });
  });

  it("append reports already_rolled_back", async () => {
    const credit = await appendOk(newEntry());
    const { userId } = credit;
    await appendOk(newEntry({ userId, version: 2n, balance: 200n }));
    const rollback = (version: bigint, balance: bigint) =>
      newEntry({
        userId,
        version,
        transactionType: "rollback",
        amount: -100n,
        balance,
        referenceId: credit.id,
      });
    await appendOk(rollback(3n, 100n));

    const result = await repo.append(rollback(4n, 0n));

    assert.deepEqual(result, { ok: false, reason: "already_rolled_back" });
  });

  it("append rethrows other database errors", async () => {
    await assert.rejects(
      repo.append(
        newEntry({ transactionType: "debit", amount: -50n, balance: -50n }),
      ),
      { constraint: "ledger_balance_check" },
    );
  });
});
