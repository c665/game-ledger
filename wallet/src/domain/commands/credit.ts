import type {
  LedgerEntry,
  NewLedgerEntry,
} from "../../repository/ledger-repository.ts";
import type { TransactionInputs } from "../types.ts";

export const createCreditEntry = ({
  input,
  latest,
}: {
  input: TransactionInputs;
  latest: LedgerEntry | null;
}): NewLedgerEntry => {
  const { userId, currencyCode, amount, externalReference } = input;
  const version = latest ? latest.version + 1n : 1n;
  const balance = latest ? latest.balance + amount : amount;

  return {
    userId,
    currencyCode,
    transactionType: "credit",
    version,
    amount,
    balance,
    referenceId: null,
    externalReference,
  };
};
