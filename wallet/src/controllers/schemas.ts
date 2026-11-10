import { z } from "zod";
import { MAX_BIGINT } from "../domain/types.ts";
import type { LedgerEntry } from "../repository/ledger-repository.ts";
import type { TransactionStatus } from "../service/types.ts";

const walletKey = {
  userId: z.uuid().transform((id) => id.toLowerCase()),
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
  externalReference: z
    .string()
    .min(1)
    .max(255)
    .regex(/^\P{Cc}+$/u, "must not contain control characters")
    .refine((value) => value.isWellFormed(), "must be well-formed Unicode"),
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
    case "balance_limit_exceeded":
      return 422;
    case "busy":
      return 503;
  }
};

export const toEntryResponse = (entry: LedgerEntry) => ({
  id: entry.id,
  userId: entry.userId,
  currencyCode: entry.currencyCode,
  transactionType: entry.transactionType,
  amount: entry.amount.toString(),
  balance: entry.balance.toString(),
  externalReference: entry.externalReference,
  createdAt: entry.createdAt.toISOString(),
});
