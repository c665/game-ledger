import { createCreditEntry } from "../domain/commands/credit.ts";
import type { TransactionInputs, WalletKey } from "../domain/types.ts";
import type { LedgerRepository } from "../repository/ledger-repository.ts";
import { createTransactionService } from "./transaction.ts";
import type { TransactionResult } from "./types.ts";

export interface WalletService {
  getBalance(key: WalletKey): Promise<bigint>;
  credit(input: TransactionInputs): Promise<TransactionResult>;
}

export type WalletServiceOptions = {
  transactionRetryAttempts: number;
};

export const createWalletService: (
  ledgerRepository: LedgerRepository,
  options: WalletServiceOptions,
) => WalletService = (ledgerRepository, { transactionRetryAttempts }) => {
  const getBalance = async ({ userId, currencyCode }: WalletKey) => {
    const latestEntry = await ledgerRepository.findLatest(userId, currencyCode);

    if (!latestEntry) {
      return 0n;
    }

    return latestEntry.balance;
  };

  return {
    getBalance,
    credit: createTransactionService(
      ledgerRepository,
      transactionRetryAttempts,
      { transactionType: "credit", decide: createCreditEntry },
    ),
  };
};
