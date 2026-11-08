import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.ts";
import type { WalletService } from "../src/service/wallet-service.ts";

let server: Server;
let baseUrl: string;

before(() => {
  server = createApp({ walletService: {} as WalletService }).listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test("GET /health returns 200 OK", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "OK" });
});
