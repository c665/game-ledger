export type WalletKey = {
  userId: string;
  currencyCode: string;
};

export type TransactionInputs = WalletKey & {
  amount: bigint;
  externalReference: string;
};

export const MAX_BIGINT = 2n ** 63n - 1n;
