import type { RequestHandler } from "express";
import { z } from "zod";
import type { WalletService } from "../service/wallet-service.ts";
import { getBalanceRequest } from "./schemas.ts";

export const createGetBalanceController: (
  walletService: WalletService,
) => RequestHandler = (walletService) => {
  return async (req, res) => {
    const parsed = getBalanceRequest.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_request",
        issues: z.flattenError(parsed.error).fieldErrors,
      });
      return;
    }

    const { userId, currencyCode } = parsed.data;

    const balance = await walletService.getBalance({ userId, currencyCode });

    res.status(200).json({ balance: balance.toString() });
  };
};
