/**
 * Double-entry ledger posting module.
 *
 * Every payment posts four balanced rows:
 *   DR accounts_receivable  (gross)
 *   CR school_net           (net after fees)
 *   CR stripe_fees_payable  (Stripe processing fee estimate)
 *   CR app_fees_payable     (School2Pay flat fee)
 *
 * Refunds post four reversing rows (DR/CR flipped) — never edit originals.
 *
 * Invariant enforced here: sum(debit_pence) === sum(credit_pence) before any
 * INSERT. An unbalanced set throws and writes nothing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { feeBreakdown } from "./fees";
import type { Database } from "./supabase/types";

type DB = SupabaseClient<Database>;

interface LedgerRow {
  transaction_id: string;
  account: string;
  debit_pence: number;
  credit_pence: number;
}

function assertBalanced(rows: LedgerRow[]): void {
  const totalDebits = rows.reduce((s, r) => s + r.debit_pence, 0);
  const totalCredits = rows.reduce((s, r) => s + r.credit_pence, 0);
  if (totalDebits !== totalCredits) {
    throw new Error(
      `Unbalanced ledger entry: debits=${totalDebits} credits=${totalCredits} (difference=${totalDebits - totalCredits})`
    );
  }
}

export async function postPaymentEntries(
  db: DB,
  transactionId: string,
  grossPence: number
): Promise<void> {
  if (grossPence <= 0) throw new Error("grossPence must be positive");

  const { stripeFee, appFee, netPence } = feeBreakdown(grossPence);

  const rows: LedgerRow[] = [
    { transaction_id: transactionId, account: "accounts_receivable", debit_pence: grossPence, credit_pence: 0 },
    { transaction_id: transactionId, account: "school_net",          debit_pence: 0, credit_pence: netPence },
    { transaction_id: transactionId, account: "stripe_fees_payable", debit_pence: 0, credit_pence: stripeFee },
    { transaction_id: transactionId, account: "app_fees_payable",    debit_pence: 0, credit_pence: appFee },
  ];

  assertBalanced(rows);

  const { error } = await db.from("ledger_entries").insert(rows);
  if (error) throw new Error(`Failed to post ledger entries: ${error.message}`);
}

export async function postRefundEntries(
  db: DB,
  transactionId: string,
  grossPence: number
): Promise<void> {
  if (grossPence <= 0) throw new Error("grossPence must be positive");

  const { stripeFee, appFee, netPence } = feeBreakdown(grossPence);

  // Reversing entries: DR/CR flipped
  const rows: LedgerRow[] = [
    { transaction_id: transactionId, account: "accounts_receivable", debit_pence: 0,         credit_pence: grossPence },
    { transaction_id: transactionId, account: "school_net",          debit_pence: netPence,  credit_pence: 0 },
    { transaction_id: transactionId, account: "stripe_fees_payable", debit_pence: stripeFee, credit_pence: 0 },
    { transaction_id: transactionId, account: "app_fees_payable",    debit_pence: appFee,    credit_pence: 0 },
  ];

  assertBalanced(rows);

  const { error } = await db.from("ledger_entries").insert(rows);
  if (error) throw new Error(`Failed to post refund entries: ${error.message}`);
}

/**
 * Verifies global ledger balance: total debits = total credits.
 * Aggregation is done in SQL to avoid loading all rows into memory.
 * Intended for CI integrity checks and the check-ledger script.
 */
export async function checkLedgerBalance(db: DB): Promise<{
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
  imbalancePence: number;
  perTransactionIssues: Array<{ transactionId: string; debits: number; credits: number }>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = (db as any).rpc.bind(db);

  // Global totals via SQL SUM — rpc returns an array; take first row
  const { data: totalsArr } = await rpc("ledger_global_totals") as {
    data: Array<{ total_debits: number; total_credits: number }> | null;
  };
  const totals = totalsArr?.[0];

  const totalDebits = Number(totals?.total_debits ?? 0);
  const totalCredits = Number(totals?.total_credits ?? 0);

  // Per-transaction imbalances via SQL GROUP BY
  const { data: txnRows } = await rpc("ledger_imbalanced_transactions") as {
    data: Array<{ transaction_id: string; debits: number; credits: number }> | null;
  };

  const perTransactionIssues = (txnRows ?? []).map((r) => ({
    transactionId: r.transaction_id,
    debits: r.debits,
    credits: r.credits,
  }));

  return {
    balanced: totalDebits === totalCredits && perTransactionIssues.length === 0,
    totalDebits,
    totalCredits,
    imbalancePence: totalDebits - totalCredits,
    perTransactionIssues,
  };
}
