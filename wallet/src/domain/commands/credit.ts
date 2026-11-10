import type {
  LedgerEntry,
  NewLedgerEntry,
} from "../../repository/ledger-repository.ts";
import { MAX_BIGINT, type TransactionInputs } from "../types.ts";

export type CreditDecision =
  | { ok: true; entry: NewLedgerEntry }
  | { ok: false; reason: "balance_limit_exceeded" };

export const createCreditEntry = ({
  input,
  latest,
}: {
  input: TransactionInputs;
  latest: LedgerEntry | null;
}): CreditDecision => {
  const { userId, currencyCode, amount, externalReference } = input;
  const version = latest ? latest.version + 1n : 1n;
  const balance = latest ? latest.balance + amount : amount;

  if (balance > MAX_BIGINT) {
    return { ok: false, reason: "balance_limit_exceeded" };
  }

  return {
    ok: true,
    entry: {
      userId,
      currencyCode,
      transactionType: "credit",
      version,
      amount,
      balance,
      referenceId: null,
      externalReference,
    },
  };
};
