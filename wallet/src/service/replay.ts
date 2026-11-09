import type { TransactionInputs } from "../domain/types.ts";
import type {
  LedgerRepository,
  TransactionType,
} from "../repository/ledger-repository.ts";
import type { ReplayResult } from "./types.ts";

export const replay = async ({
  ledgerRepository,
  input,
  expected,
}: {
  ledgerRepository: LedgerRepository;
  input: TransactionInputs;
  expected: {
    transactionType: TransactionType;
    amount: bigint;
  };
}): Promise<ReplayResult> => {
  const stored = await ledgerRepository.findByExternalReference(
    input.externalReference,
  );

  if (!stored) {
    throw new Error(
      `no entry for duplicate externalReference=${input.externalReference}`,
    );
  }

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
