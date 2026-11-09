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

// HTTP layer only: the service is a fake, so no database is needed.

describe("POST /wallets/:userId/:currencyCode/credit", () => {
  let server: Server;
  let baseUrl: string;
  let calls: TransactionInputs[];
  let result: TransactionResult;

  const walletService: WalletService = {
    getBalance: async () => {
      throw new Error("not used");
    },
    credit: async (input) => {
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

  const entry = (): LedgerEntry => ({
    id: randomUUID(),
    userId: randomUUID(),
    currencyCode: "EUR",
    version: 3n,
    transactionType: "credit",
    amount: 100n,
    balance: 250n,
    referenceId: null,
    externalReference: randomUUID(),
    createdAt: new Date(),
  });

  const credit = (userId: string, currencyCode: string, body: unknown) =>
    fetch(`${baseUrl}/wallets/${userId}/${currencyCode}/credit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const validBody = () => ({ amount: "100", externalReference: randomUUID() });

  it("returns 201 with the new entry, numbers as strings", async () => {
    const created = entry();
    result = { status: "created", entry: created };
    const userId = randomUUID();
    const body = validBody();

    const res = await credit(userId, "EUR", body);

    assert.equal(res.status, 201);
    const { entry: sent } = await res.json();
    assert.equal(sent.id, created.id);
    assert.equal(sent.amount, "100");
    assert.equal(sent.balance, "250");
    assert.equal(sent.version, "3");
    assert.deepEqual(calls, [
      {
        userId,
        currencyCode: "EUR",
        amount: 100n,
        externalReference: body.externalReference,
      },
    ]);
  });

  it("returns 200 with the stored entry on a replay", async () => {
    const stored = entry();
    result = { status: "replayed", entry: stored };

    const res = await credit(randomUUID(), "EUR", validBody());

    assert.equal(res.status, 200);
    assert.equal((await res.json()).entry.id, stored.id);
  });

  it("returns 409 on a conflicting reuse of a reference", async () => {
    result = { status: "conflict" };

    const res = await credit(randomUUID(), "EUR", validBody());

    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { status: "conflict" });
  });

  it("takes the wallet from the path, not the body", async () => {
    result = { status: "created", entry: entry() };
    const pathUser = randomUUID();

    await credit(pathUser, "EUR", {
      ...validBody(),
      userId: randomUUID(),
      currencyCode: "USD",
    });

    assert.equal(calls[0]?.userId, pathUser);
    assert.equal(calls[0]?.currencyCode, "EUR");
  });

  it("rejects an invalid body without calling the service", async () => {
    const res = await credit(randomUUID(), "EUR", {
      amount: 100,
      externalReference: "",
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid_request");
    assert.deepEqual(Object.keys(body.issues).sort(), [
      "amount",
      "externalReference",
    ]);
    assert.deepEqual(calls, []);
  });

  it("rejects an invalid wallet in the path without calling the service", async () => {
    const res = await credit("not-a-uuid", "eur", validBody());

    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys((await res.json()).issues).sort(), [
      "currencyCode",
      "userId",
    ]);
    assert.deepEqual(calls, []);
  });
});
