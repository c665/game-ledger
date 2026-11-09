import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.ts";
import type { WalletService } from "../src/service/wallet-service.ts";

// What clients receive when something fails: always JSON, never a stack trace.

describe("error handling", () => {
  let server: Server;
  let baseUrl: string;

  const walletService: WalletService = {
    getBalance: async () => {
      throw new Error("connect ECONNREFUSED secret-db:5432");
    },
    credit: async (_input) => {
      throw new Error("connect ECONNREFUSED secret-db:5432");
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

  it("returns a JSON 500 with an errorId, and logs the error under it", async (t) => {
    const logged = t.mock.method(console, "error", () => {});

    const res = await fetch(`${baseUrl}/wallets/${randomUUID()}/EUR/balance`);

    assert.equal(res.status, 500);
    assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
    const body = await res.json();
    assert.equal(body.error, "internal_error");
    assert.match(body.errorId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(Object.keys(body).sort(), ["error", "errorId"]);

    assert.equal(logged.mock.callCount(), 1);
    assert.match(
      String(logged.mock.calls[0]?.arguments[0]),
      new RegExp(body.errorId),
    );
  });

  it("returns a JSON 400 for a URL that can't be decoded", async () => {
    const res = await fetch(`${baseUrl}/wallets/%E0%A4%A/EUR/balance`);

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "invalid_request" });
  });

  it("returns a JSON 400 for a malformed JSON body", async () => {
    const res = await fetch(`${baseUrl}/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "invalid_request" });
  });
});
