import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import type { TransactionInputs } from "../src/domain/types.ts";
import type { LedgerEntry } from "../src/repository/ledger-repository.ts";
import type { TransactionResult } from "../src/service/types.ts";
import type { WalletService } from "../src/service/wallet-service.ts";

// HTTP layer only: the service is a fake, so no database is needed. The
// controller is shared with credits, whose tests cover validation and the
// other statuses; these cover what the debit route adds.

describe("POST /wallets/:userId/:currencyCode/debit", () => {
  let server: Server;
  let baseUrl: string;
  let calls: TransactionInputs[];
  let result: TransactionResult;

  const walletService: WalletService = {
    getBalance: async () => {
      throw new Error("not used");
    },
    credit: async () => {
      throw new Error("a debit must not credit");
    },
    debit: async (input) => {
      calls.push(input);
      return result;
    },
  };

  before(() => {
    server = createApp({ walletService }).listen(0);
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  beforeEach(() => {
    calls = [];
  });

  const debit = (userId: string, currencyCode: string, body: unknown) =>
    fetch(`${baseUrl}/wallets/${userId}/${currencyCode}/debit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("returns 201 with the entry, its amount negative", async () => {
    const created: LedgerEntry = {
      id: randomUUID(),
      userId: randomUUID(),
      currencyCode: "EUR",
      version: 2n,
      transactionType: "debit",
      amount: -30n,
      balance: 70n,
      referenceId: null,
      externalReference: randomUUID(),
      createdAt: new Date(),
    };
    result = { status: "created", entry: created };
    const userId = randomUUID();

    const res = await debit(userId, "EUR", {
      amount: "30",
      externalReference: created.externalReference,
    });

    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), {
      entry: {
        id: created.id,
        userId: created.userId,
        currencyCode: "EUR",
        transactionType: "debit",
        amount: "-30",
        balance: "70",
        externalReference: created.externalReference,
        createdAt: created.createdAt.toISOString(),
      },
    });
    assert.deepEqual(calls, [
      {
        userId,
        currencyCode: "EUR",
        amount: 30n,
        externalReference: created.externalReference,
      },
    ]);
  });

  it("returns 422 when the balance can't cover the debit", async () => {
    result = { status: "insufficient_funds" };

    const res = await debit(randomUUID(), "EUR", {
      amount: "30",
      externalReference: randomUUID(),
    });

    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: "insufficient_funds" });
  });

  it("rejects a negative amount without calling the service", async () => {
    const res = await debit(randomUUID(), "EUR", {
      amount: "-30",
      externalReference: randomUUID(),
    });

    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys((await res.json()).issues), ["amount"]);
    assert.deepEqual(calls, []);
  });
});
