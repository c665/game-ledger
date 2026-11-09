import type { RequestHandler } from "express";
import type { WalletService } from "../service/wallet-service.ts";
import {
  toEntryResponse,
  toHttpStatus,
  transactionBody,
  walletParams,
} from "./schemas.ts";

export const createCreditController: (
  walletService: WalletService,
) => RequestHandler = (walletService) => {
  return async (req, res) => {
    const { userId, currencyCode } = walletParams.parse(req.params);
    const { amount, externalReference } = transactionBody.parse(req.body);

    const result = await walletService.credit({
      userId,
      currencyCode,
      amount,
      externalReference,
    });

    const status = toHttpStatus(result.status);

    if (result.status === "created" || result.status === "replayed") {
      res.status(status).json({ entry: toEntryResponse(result.entry) });
    } else {
      res.status(status).json({ status: result.status });
    }
  };
};
