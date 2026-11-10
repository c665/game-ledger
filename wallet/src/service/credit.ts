import { createCreditEntry } from "../domain/commands/credit.ts";
import type { TransactionInputs } from "../domain/types.ts";
import type { LedgerRepository } from "../repository/ledger-repository.ts";
import { replay } from "./replay.ts";
import type { ReplayResult, TransactionResult } from "./types.ts";

export const createCreditService = (
  ledgerRepository: LedgerRepository,
  retryAttempts: number,
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
        transactionType: "credit",
        amount: input.amount,
      },
    });
  };

  const credit = async (
    input: TransactionInputs,
    attempt: number,
  ): Promise<TransactionResult> => {
    const { userId, currencyCode, amount, externalReference } = input;

    console.log(
      `credit-begin userId=${input.userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference}`,
    );

    const latest = await ledgerRepository.findLatest(userId, currencyCode);

    const decision = createCreditEntry({ input, latest });

    if (!decision.ok) {
      const replayed = await findReplay(input);

      if (replayed) {
        return replayed;
      }

      console.log(
        `credit-refused userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference} reason=${decision.reason}`,
      );

      return { status: decision.reason };
    }

    const result = await ledgerRepository.append(decision.entry);

    if (result.ok) {
      console.log(
        `credit-success userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference}`,
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
        `credit: unexpected append failure ${result.reason} for externalReference=${externalReference}`,
      );
    }

    if (attempt < retryAttempts) {
      return credit(input, attempt + 1);
    }

    console.log(
      `credit-failure userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference} reason=${result.reason}`,
    );

    throw new Error(
      `credit failure after ${attempt + 1} attempts, all version conflicts`,
    );
  };

  return (input: TransactionInputs) => credit(input, 0);
};
