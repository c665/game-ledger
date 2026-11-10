import type { LedgerEntry } from "../repository/ledger-repository.ts";

export type ReplayResult =
  | { status: "replayed"; entry: LedgerEntry }
  | { status: "conflict" };

export type TransactionResult =
  | { status: "created"; entry: LedgerEntry }
  | ReplayResult
  | { status: "insufficient_funds" }
  | { status: "balance_limit_exceeded" };

export type TransactionStatus = TransactionResult["status"];
