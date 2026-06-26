/**
 * Ledger integrity check — run in CI or manually:
 *   npx tsx scripts/check-ledger.ts
 *
 * Exits 0 if balanced, 1 if any imbalance found.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import type { Database } from "../src/lib/supabase/types";
import { checkLedgerBalance } from "../src/lib/ledger";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Checking ledger balance...\n");

  const result = await checkLedgerBalance(db);

  console.log(`Total debits:  ${result.totalDebits}p (£${(result.totalDebits / 100).toFixed(2)})`);
  console.log(`Total credits: ${result.totalCredits}p (£${(result.totalCredits / 100).toFixed(2)})`);

  if (result.balanced) {
    console.log("\n✓ Ledger is balanced — debits equal credits globally and per transaction.\n");
    process.exit(0);
  }

  console.error(`\n✗ LEDGER IMBALANCE DETECTED`);
  console.error(`  Global imbalance: ${result.imbalancePence}p`);

  if (result.perTransactionIssues.length > 0) {
    console.error(`\n  Unbalanced transactions:`);
    for (const issue of result.perTransactionIssues) {
      console.error(
        `    txn ${issue.transactionId}: debits=${issue.debits}p credits=${issue.credits}p (diff=${issue.debits - issue.credits}p)`
      );
    }
  }

  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
