import type { TransactionInputs, WalletKey } from "../domain/types.ts";
import type { LedgerRepository } from "../repository/ledger-repository.ts";
import { createCreditService } from "./credit.ts";
import type { TransactionResult } from "./types.ts";

export interface WalletService {
  getBalance(key: WalletKey): Promise<bigint>;
  credit(input: TransactionInputs): Promise<TransactionResult>;
}

export const createWalletService: (
  ledgerRepository: LedgerRepository,
) => WalletService = (ledgerRepository) => {
  const getBalance = async ({ userId, currencyCode }: WalletKey) => {
    const latestEntry = await ledgerRepository.findLatest(userId, currencyCode);

    if (!latestEntry) {
      return 0n;
    }

    return latestEntry.balance;
  };

  return {
    getBalance,
    credit: createCreditService(ledgerRepository),
  };
};
