import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { Pool } from "pg";
import { createDbPool } from "../src/db/create-db-pool.ts";
import { MAX_BIGINT, type TransactionInputs } from "../src/domain/types.ts";
import type {
  AppendResult,
  LedgerRepository,
} from "../src/repository/ledger-repository.ts";
import { createPgLedgerRepository } from "../src/repository/pg-ledger-repository.ts";
import {
  createWalletService,
  type WalletService,
} from "../src/service/wallet-service.ts";

// Runs against the real database: `docker compose up -d --wait` and
// `npm run db:deploy` first.

// Pinned rather than read from the environment, so the tests don't change
// with a developer's .env.
const RETRIES = 3;

// Wraps a repository and counts the version conflicts append reports.
const countingConflicts = (repo: LedgerRepository) => {
  let conflicts = 0;
  return {
    repo: {
      ...repo,
      append: async (entry) => {
        const result: AppendResult = await repo.append(entry);
        if (!result.ok && result.reason === "version_conflict") {
          conflicts++;
        }
        return result;
      },
    } satisfies LedgerRepository,
    conflicts: () => conflicts,
  };
};

describe("wallet service", () => {
  let pool: Pool;
  let repo: LedgerRepository;
  let service: WalletService;

  before(() => {
    pool = createDbPool();
    repo = createPgLedgerRepository(pool);
    service = createWalletService(repo, { transactionRetryAttempts: RETRIES });
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
      const writers = RETRIES + 1;
      const counting = countingConflicts(repo);
      const concurrentService = createWalletService(counting.repo, {
        transactionRetryAttempts: RETRIES,
      });
      const { userId } = creditInput();

      const results = await Promise.all(
        Array.from({ length: writers }, () =>
          concurrentService.credit(creditInput({ userId, amount: 10n })),
        ),
      );

      // Without a conflict, the retry path didn't run and the test proved nothing.
      assert.ok(counting.conflicts() > 0, "expected at least one conflict");
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

    it("gives up after the configured retries", async () => {
      let appends = 0;
      const alwaysConflicting: LedgerRepository = {
        findLatest: async () => null,
        findByExternalReference: async () => null,
        append: async () => {
          appends++;
          return { ok: false, reason: "version_conflict" };
        },
      };
      const retries = 2;
      const failing = createWalletService(alwaysConflicting, {
        transactionRetryAttempts: retries,
      });

      await assert.rejects(failing.credit(creditInput()), /after 3 attempts/);
      assert.equal(appends, retries + 1);
    });

    it("replays a stored request even when the version conflict is reported", async () => {
      const input = creditInput();
      const first = await service.credit(input);
      assert.ok(first.status === "created");

      // A stale read: the retry computes version 1 again, which breaks both
      // unique constraints. Postgres reports the version one.
      const staleRepo: LedgerRepository = {
        ...repo,
        findLatest: async () => null,
      };
      const stale = await repo.append(first.entry);
      assert.deepEqual(stale, { ok: false, reason: "version_conflict" });
      // With no retries, only the reference lookup can turn this into a replay.
      const staleService = createWalletService(staleRepo, {
        transactionRetryAttempts: 0,
      });

      const result = await staleService.credit(input);

      assert.deepEqual(result, { status: "replayed", entry: first.entry });
    });

    it("reports a conflict when another wallet reuses the reference", async () => {
      const input = creditInput();
      await service.credit(input);

      const otherUser = await service.credit({
        ...input,
        userId: randomUUID(),
      });
      const otherCurrency = await service.credit({
        ...input,
        currencyCode: "USD",
      });

      assert.deepEqual(otherUser, { status: "conflict" });
      assert.deepEqual(otherCurrency, { status: "conflict" });
    });

    it("refuses a credit that would overflow the balance", async () => {
      const input = creditInput({ amount: MAX_BIGINT });
      await service.credit(input);

      const result = await service.credit(
        creditInput({ userId: input.userId, amount: 1n }),
      );

      assert.deepEqual(result, { status: "balance_limit_exceeded" });
      assert.equal(await service.getBalance(input), MAX_BIGINT);
    });
  });
});
