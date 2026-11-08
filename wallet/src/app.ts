import express from "express";
import { createGetBalanceController } from "./controllers/create-get-balance-controller.ts";
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

  return app;
}
