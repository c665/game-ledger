import { config } from "../config.ts";
import { createCreditEntry } from "../domain/commands/credit.ts";
import type { TransactionInputs } from "../domain/types.ts";
import type { LedgerRepository } from "../repository/ledger-repository.ts";
import { replay } from "./replay.ts";
import type { TransactionResult } from "./types.ts";

export const createCreditService = (ledgerRepository: LedgerRepository) => {
  const credit = async (
    input: TransactionInputs,
    attempt: number,
  ): Promise<TransactionResult> => {
    const { userId, currencyCode, amount, externalReference } = input;

    console.log(
      `credit-begin userId=${input.userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference}`,
    );

    const latest = await ledgerRepository.findLatest(userId, currencyCode);

    const result = await ledgerRepository.append(
      createCreditEntry({
        input,
        latest,
      }),
    );

    if (result.ok) {
      console.log(
        `credit-success userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference}`,
      );

      return {
        status: "created",
        entry: result.entry,
      };
    }

    if (result.reason === "duplicate_external_reference") {
      return replay({
        ledgerRepository,
        input,
        expected: {
          transactionType: "credit",
          amount,
        },
      });
    }

    // version_conflict is the last remaining failrue reason
    if (attempt < config.domain.transactionRetryAttempts) {
      return credit(input, attempt + 1);
    }

    console.log(
      `credit-failure userId=${userId} currencyCode=${currencyCode} amount=${amount} externalReference=${externalReference} reason=${result.reason}`,
    );

    throw new Error(
      `credit failure after ${config.domain.transactionRetryAttempts} version conflicts`,
    );
  };

  return (input: TransactionInputs) => credit(input, 0);
};
