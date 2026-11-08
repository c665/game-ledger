import { z } from "zod";

const walletKey = {
  userId: z.uuid(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/, "must be an ISO 4217 code"),
};

export const getBalanceRequest = z.object({
  ...walletKey,
});
