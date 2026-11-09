import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { Pool } from "pg";
import { config } from "../src/config.ts";
import { createDbPool } from "../src/db/create-db-pool.ts";
import type { TransactionInputs } from "../src/domain/types.ts";
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

  describe("credit", () => {
    const creditInput = (overrides: Partial<TransactionInputs> = {}) => ({
      userId: randomUUID(),
      currencyCode: "EUR",
      amount: 100n,
      externalReference: randomUUID(),
      ...overrides,
    });

    it("starts an empty wallet at version 1", async () => {
      const input = creditInput();

      const result = await service.credit(input);

      assert.equal(result.status, "created");
      assert.ok(result.status === "created");
      assert.equal(result.entry.version, 1n);
      assert.equal(result.entry.amount, 100n);
      assert.equal(result.entry.balance, 100n);
      assert.equal(result.entry.transactionType, "credit");
      assert.equal(await service.getBalance(input), 100n);
    });

    it("adds to the latest balance", async () => {
      const { userId } = creditInput();
      await service.credit(creditInput({ userId }));

      const result = await service.credit(creditInput({ userId, amount: 50n }));

      assert.ok(result.status === "created");
      assert.equal(result.entry.version, 2n);
      assert.equal(result.entry.balance, 150n);
    });

    it("replays a repeated request without moving money again", async () => {
      const input = creditInput();
      const first = await service.credit(input);
      assert.ok(first.status === "created");

      const second = await service.credit(input);

      assert.deepEqual(second, { status: "replayed", entry: first.entry });
      assert.equal(await service.getBalance(input), 100n);
    });

    it("reports a conflict when a reference is reused with a different amount", async () => {
      const input = creditInput();
      await service.credit(input);

      const result = await service.credit({ ...input, amount: 5n });

      assert.deepEqual(result, { status: "conflict" });
      assert.equal(await service.getBalance(input), 100n);
    });

    it("retries version conflicts so concurrent credits all land", async () => {
      // Each loss means another writer committed first, so a writer loses at
      // most (writers - 1) times. With one writer more than the retries, every
      // credit must still succeed.
      const writers = config.domain.transactionRetryAttempts + 1;
      const { userId } = creditInput();

      const results = await Promise.all(
        Array.from({ length: writers }, () =>
          service.credit(creditInput({ userId, amount: 10n })),
        ),
      );

      assert.ok(results.every((result) => result.status === "created"));
      const versions = results
        .map((result) =>
          result.status === "created" ? result.entry.version : 0n,
        )
        .sort((a, b) => Number(a - b));
      assert.deepEqual(
        versions,
        Array.from({ length: writers }, (_, i) => BigInt(i + 1)),
      );
      assert.equal(
        await service.getBalance({ userId, currencyCode: "EUR" }),
        BigInt(writers) * 10n,
      );
    });
  });
});
