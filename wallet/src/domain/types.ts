export type WalletKey = {
  userId: string;
  currencyCode: string;
};

export type TransactionInputs = WalletKey & {
  amount: bigint;
  externalReference: string;
};
