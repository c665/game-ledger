import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { createDbPool } from "./db/create-db-pool.ts";
import { createPgLedgerRepository } from "./repository/pg-ledger-repository.ts";
import { createWalletService } from "./service/wallet-service.ts";

console.log("Config loaded:", {
  ...config,
  db: { ...config.db, password: "****" },
});

const dbPool = createDbPool();
const ledgerRepository = createPgLedgerRepository(dbPool);
const walletService = createWalletService(ledgerRepository);

const app = createApp({ walletService });
const port = config.server.port;

const server = app.listen(port, () => {
  console.log(`wallet listening on :${port}`);
});

// Stop taking requests, let the ones in flight finish, then close the pool.
// If that hangs, exit anyway so the orchestrator isn't left waiting.
const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`${signal} received, shutting down`);

  setTimeout(() => {
    console.error("shutdown timed out, exiting");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(async (error) => {
    await dbPool.end();
    process.exit(error ? 1 : 0);
  });
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
