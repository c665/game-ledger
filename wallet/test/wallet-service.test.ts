import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { Pool } from "pg";
import { createDbPool } from "../src/db/create-db-pool.ts";
import type { LedgerRepository } from "../src/repository/ledger-repository.ts";
import { createPgLedgerRepository } from "../src/repository/pg-ledger-repository.ts";
import {
  createWalletService,
  type WalletService,
} from "../src/service/wallet-service.ts";

// Runs against the real database: `docker compose up -d --wait` and
// `npm run db:deploy` first.

describe("wallet service", () => {
  let pool: Pool;
  let repo: LedgerRepository;
  let service: WalletService;

  before(() => {
    pool = createDbPool();
    repo = createPgLedgerRepository(pool);
    service = createWalletService(repo);
  });

  after(async () => {
    await pool.end();
  });

  describe("getBalance", () => {
    it("returns 0 for a wallet with no entries", async () => {
      const balance = await service.getBalance({
        userId: randomUUID(),
        currencyCode: "EUR",
      });

      assert.equal(balance, 0n);
    });

    it("returns the latest entry's balance", async () => {
      const userId = randomUUID();
      const credit = (version: bigint, balance: bigint) =>
        repo.append({
          userId,
          currencyCode: "EUR",
          version,
          transactionType: "credit",
          amount: 100n,
          balance,
          referenceId: null,
          externalReference: randomUUID(),
        });
      await credit(1n, 100n);
      await credit(2n, 200n);

      const balance = await service.getBalance({ userId, currencyCode: "EUR" });

      assert.equal(balance, 200n);
    });
  });
});
