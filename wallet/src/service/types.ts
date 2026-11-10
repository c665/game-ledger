import type { LedgerEntry } from "../repository/ledger-repository.ts";

export type ReplayResult =
  | { status: "replayed"; entry: LedgerEntry }
  | { status: "conflict" };

// What a credit or debit returns. Credit never refuses, but sharing one type
// lets both controllers use the same status-to-HTTP mapping.
export type TransactionResult =
  | { status: "created"; entry: LedgerEntry }
  | ReplayResult
  | { status: "insufficient_funds" }
  | { status: "balance_limit_exceeded" };

export type TransactionStatus = TransactionResult["status"];
