import type { RequestHandler } from "express";
import { z } from "zod";
import type { WalletService } from "../service/wallet-service.ts";
import { getBalanceRequest } from "./schemas.ts";

export const createGetBalanceController: (
  walletService: WalletService,
) => RequestHandler = (walletService) => {
  return async (req, res) => {
    const { userId, currencyCode } = getBalanceRequest.parse(req.params);

    const balance = await walletService.getBalance({ userId, currencyCode });

    res.status(200).json({ balance: balance.toString() });
  };
};
