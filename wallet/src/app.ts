import express from "express";
import { createGetBalanceController } from "./controllers/create-get-balance-controller.ts";
import { createTransactionController } from "./controllers/create-transaction-controller.ts";
import { createErrorHandlingMiddleware } from "./middlewares/create-error-handling-middleware.ts";
import type { WalletService } from "./service/wallet-service.ts";

export function createApp({ walletService }: { walletService: WalletService }) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "OK" });
  });

  app.get(
    "/wallets/:userId/:currencyCode/balance",
    createGetBalanceController(walletService),
  );

  app.post(
    "/wallets/:userId/:currencyCode/credit",
    createTransactionController(walletService, "credit"),
  );

  app.use(createErrorHandlingMiddleware());

  return app;
}
