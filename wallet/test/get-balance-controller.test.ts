import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import type { WalletKey } from "../src/domain/types.ts";
import type { WalletService } from "../src/service/wallet-service.ts";

// HTTP layer only: the service is a fake, so no database is needed.

describe("GET /wallets/:userId/:currencyCode/balance", () => {
  let server: Server;
  let baseUrl: string;
  let calls: WalletKey[];

  const walletService: WalletService = {
    getBalance: async (key) => {
      calls.push(key);
      return 123n;
    },
    credit: async (_input) => {
      throw new Error("not implemented");
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

  const getBalance = (userId: string, currencyCode: string) =>
    fetch(`${baseUrl}/wallets/${userId}/${currencyCode}/balance`);

  it("returns the balance as a string", async () => {
    const userId = randomUUID();

    const res = await getBalance(userId, "EUR");

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { balance: "123" });
    assert.deepEqual(calls, [{ userId, currencyCode: "EUR" }]);
  });

  it("rejects an invalid user ID or currency code", async () => {
    const res = await getBalance("not-a-uuid", "eur");

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid_request");
    assert.deepEqual(Object.keys(body.issues).sort(), [
      "currencyCode",
      "userId",
    ]);
    assert.deepEqual(calls, []);
  });
});
