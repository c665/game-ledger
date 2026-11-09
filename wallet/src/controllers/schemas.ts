import { z } from "zod";
import type { LedgerEntry } from "../repository/ledger-repository.ts";
import type { TransactionStatus } from "../service/types.ts";

const MAX_BIGINT = 2n ** 63n - 1n;

const walletKey = {
  userId: z.uuid(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/, "must be an ISO 4217 code"),
};

export const getBalanceRequest = z.object({
  ...walletKey,
});

// The wallet is identified by the path, never the body.
export const walletParams = z.object({
  ...walletKey,
});

const amount = z
  .string()
  .regex(/^[1-9]\d*$/, "must be a positive integer string")
  .transform(BigInt)
  .refine((value) => value <= MAX_BIGINT, "is too large");

// Credits and debits take the same body; the route decides the direction.
export const transactionBody = z.object({
  amount,
  externalReference: z.string().min(1).max(255),
});

export const toHttpStatus = (status: TransactionStatus) => {
  switch (status) {
    case "replayed":
      return 200;
    case "conflict":
      return 409;
    case "created":
      return 201;
    case "insufficient_funds":
      return 422;
  }
};

export const toEntryResponse = (entry: LedgerEntry) => {
  return {
    status: "success",
    ...entry,
    amount: entry.amount.toString(),
    balance: entry.balance.toString(),
    version: entry.version.toString(),
  };
};
