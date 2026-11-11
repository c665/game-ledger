import type {
  LedgerEntry,
  NewLedgerEntry,
} from "../../repository/ledger-repository.ts";
import type { TransactionInputs } from "../types.ts";

export type DebitDecision =
  | { ok: true; entry: NewLedgerEntry }
  | { ok: false; reason: "insufficient_funds" };

export const createDebitEntry = ({
  input,
  latest,
}: {
  input: TransactionInputs;
  latest: LedgerEntry | null;
}): DebitDecision => {
  const { userId, currencyCode, amount, externalReference } = input;

  // A wallet with no rows holds nothing, and we don't write zero rows,
  // so it can't be debited.
  if (!latest || latest.balance < amount) {
    return { ok: false, reason: "insufficient_funds" };
  }

  return {
    ok: true,
    entry: {
      userId,
      currencyCode,
      transactionType: "debit",
      version: latest.version + 1n,
      amount: -amount,
      balance: latest.balance - amount,
      referenceId: null,
      externalReference,
    },
  };
};
