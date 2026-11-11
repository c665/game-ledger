import type { RequestHandler } from "express";
import type { WalletService } from "../service/wallet-service.ts";
import {
  toEntryResponse,
  toHttpStatus,
  transactionBody,
  walletParams,
} from "./schemas.ts";

// Credits and debits share a request and response shape; the route picks
// which service method moves the money.
export const createTransactionController: (
  walletService: WalletService,
  transactionType: "credit" | "debit",
) => RequestHandler = (walletService, transactionType) => {
  return async (req, res) => {
    const { userId, currencyCode } = walletParams.parse(req.params);
    const { amount, externalReference } = transactionBody.parse(req.body);

    const result = await walletService[transactionType]({
      userId,
      currencyCode,
      amount,
      externalReference,
    });

    const status = toHttpStatus(result.status);

    if (result.status === "created" || result.status === "replayed") {
      res.status(status).json({ entry: toEntryResponse(result.entry) });
      return;
    }

    if (result.status === "busy") {
      res.set("Retry-After", "1");
    }

    res.status(status).json({ error: result.status });
  };
};
