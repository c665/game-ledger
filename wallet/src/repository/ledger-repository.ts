export type TransactionType = "credit" | "debit" | "rollback" | "adjustment";

export type LedgerEntry = {
  id: string;
  userId: string;
  currencyCode: string;
  version: bigint;
  transactionType: TransactionType;
  amount: bigint;
  balance: bigint;
  referenceId: string | null;
  externalReference: string;
  createdAt: Date;
};

export type NewLedgerEntry = Omit<LedgerEntry, "id" | "createdAt">;

export type AppendFailure =
  | "version_conflict"
  | "duplicate_external_reference"
  | "already_rolled_back";

export type AppendResult =
  | { ok: true; entry: LedgerEntry }
  | { ok: false; reason: AppendFailure };

export interface LedgerRepository {
  findLatest(userId: string, currencyCode: string): Promise<LedgerEntry | null>;

  findByExternalReference(
    externalReference: string,
  ): Promise<LedgerEntry | null>;

  append(entry: NewLedgerEntry): Promise<AppendResult>;
}
