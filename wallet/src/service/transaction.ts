import type { TransactionInputs } from "../domain/types.ts";
import type {
  LedgerEntry,
  LedgerRepository,
  NewLedgerEntry,
} from "../repository/ledger-repository.ts";
import { replay } from "./replay.ts";
import type { ReplayResult, TransactionResult } from "./types.ts";

type Direction = "credit" | "debit";

// Requests carry positive amounts; the ledger stores debits as negative.
const SIGN: Record<Direction, bigint> = { credit: 1n, debit: -1n };

export type Decision =
  | { ok: true; entry: NewLedgerEntry }
  | { ok: false; reason: "insufficient_funds" | "balance_limit_exceeded" };

export type Decide = (args: {
  input: TransactionInputs;
  latest: LedgerEntry | null;
}) => Decision;

// Reads the wallet's latest row, decides the next one and appends it,
// retrying when another writer took the version first. A request whose
// externalReference is already stored is replayed or reported as a conflict.
export const createTransactionService = (
  ledgerRepository: LedgerRepository,
  retryAttempts: number,
  { transactionType, decide }: { transactionType: Direction; decide: Decide },
) => {
  const findReplay = async (
    input: TransactionInputs,
  ): Promise<ReplayResult | null> => {
    const stored = await ledgerRepository.findByExternalReference(
      input.externalReference,
    );

    if (!stored) {
      return null;
    }

    return replay({
      stored,
      input,
      expected: {
        transactionType,
        amount: input.amount * SIGN[transactionType],
      },
    });
  };

  const run = async (
    input: TransactionInputs,
    attempt: number,
  ): Promise<TransactionResult> => {
    const { userId, currencyCode, amount, externalReference } = input;

    console.log(
      `${transactionType}-begin userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference}`,
    );

    const latest = await ledgerRepository.findLatest(userId, currencyCode);

    const decision = decide({ input, latest });

    if (!decision.ok) {
      const replayed = await findReplay(input);

      if (replayed) {
        return replayed;
      }

      console.log(
        `${transactionType}-refused userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference} reason=${decision.reason}`,
      );

      return { status: decision.reason };
    }

    const result = await ledgerRepository.append(decision.entry);

    if (result.ok) {
      console.log(
        `${transactionType}-success userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference}`,
      );

      return {
        status: "created",
        entry: result.entry,
      };
    }

    const replayed = await findReplay(input);

    if (replayed) {
      return replayed;
    }

    if (result.reason !== "version_conflict") {
      throw new Error(
        `${transactionType}: unexpected append failure ${result.reason} for externalReference=${externalReference}`,
      );
    }

    if (attempt < retryAttempts) {
      return run(input, attempt + 1);
    }

    console.log(
      `${transactionType}-failure userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference} attempts=${attempt + 1}`,
    );

    return { status: "busy" };
  };

  return (input: TransactionInputs) => run(input, 0);
};
