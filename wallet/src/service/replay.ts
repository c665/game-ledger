import type { TransactionInputs } from "../domain/types.ts";
import type {
  LedgerEntry,
  TransactionType,
} from "../repository/ledger-repository.ts";
import type { ReplayResult } from "./types.ts";

// The request's externalReference is already stored. Decide whether this
// request is a retry of that one or a reuse of the reference for something else.
export const replay = ({
  stored,
  input,
  expected,
}: {
  stored: LedgerEntry;
  input: TransactionInputs;
  expected: {
    transactionType: TransactionType;
    amount: bigint;
  };
}): ReplayResult => {
  const sameRequest =
    stored.userId === input.userId &&
    stored.currencyCode === input.currencyCode &&
    stored.amount === expected.amount &&
    stored.transactionType === expected.transactionType;

  if (!sameRequest) {
    console.log(
      `${expected.transactionType}-conflict userId=${input.userId} currencyCode=${input.currencyCode} amount=${input.amount} externalReference=${input.externalReference}`,
    );
    return { status: "conflict" };
  }

  console.log(
    `${expected.transactionType}-replayed userId=${input.userId} currencyCode=${input.currencyCode} amount=${input.amount} externalReference=${input.externalReference}`,
  );
  return {
    status: "replayed",
    entry: stored,
  };
};
