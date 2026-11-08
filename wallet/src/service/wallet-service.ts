import type { LedgerRepository } from "../repository/ledger-repository.ts";
import type { WalletKey } from "./types.ts";

export interface WalletService {
  getBalance(key: WalletKey): Promise<bigint>;
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
  };
};
