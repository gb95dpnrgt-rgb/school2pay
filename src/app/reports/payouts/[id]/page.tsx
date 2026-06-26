import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import { formatPence } from "@/lib/fees";
import type { Database } from "@/lib/supabase/types";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type PayoutLine = {
  id: string;
  transaction_id: string | null;
  stripe_balance_txn_id: string;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  type: string;
  gross_pence: number;
  stripe_fee_pence: number;
  app_fee_pence: number;
  net_pence: number;
  description: string | null;
  matched: boolean;
};

type Payout = {
  id: string;
  stripe_payout_id: string;
  school_id: string;
  arrival_date: string;
  currency: string;
  gross_pence: number;
  stripe_fees_pence: number;
  app_fees_pence: number;
  net_pence: number;
  unmatched_count: number;
  status: string;
  description: string | null;
};

export default async function PayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  const admin = getAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payout } = await (admin.from("payouts") as any)
    .select("*")
    .eq("id", id)
    .eq("school_id", school?.id)
    .maybeSingle() as { data: Payout | null };

  if (!payout) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lines } = await (admin.from("payout_lines") as any)
    .select("*")
    .eq("payout_id", id)
    .order("matched", { ascending: false })   // unmatched first (for visibility)
    .order("gross_pence", { ascending: false }) as { data: PayoutLine[] | null };

  const unmatchedLines = (lines ?? []).filter((l) => !l.matched && l.type !== "payout");
  const matchedLines = (lines ?? []).filter((l) => l.matched);

  const arrivalFormatted = new Date(payout.arrival_date).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const csvUrl = `/api/export/payouts/${payout.id}`;

  return (
    <>
      {/* Print-only global styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          main { padding: 0; }
        }
      `}</style>

      <main className="min-h-screen bg-gray-50 print:bg-white">
        {/* Nav — hidden on print */}
        <nav className="no-print bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-gray-900">School2Pay</span>
            <span aria-hidden="true" className="text-gray-300">|</span>
            <a href="/reports/payouts" className="text-sm text-gray-500 hover:text-gray-800">← Payouts</a>
          </div>
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </form>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Payout reconciliation</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">{arrivalFormatted}</h1>
              <p className="mt-0.5 text-sm text-gray-500">{school?.name}</p>
              <p className="mt-0.5 text-xs text-gray-400 font-mono">{payout.stripe_payout_id}</p>
            </div>
            <div className="no-print flex gap-2">
              <a
                href={csvUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                ↓ Export CSV
              </a>
              <PrintButton />
            </div>
          </div>

          {/* Summary panel */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              <SummaryCell label="Gross collected" value={formatPence(payout.gross_pence)} />
              <SummaryCell label="Stripe fees" value={`−${formatPence(payout.stripe_fees_pence)}`} red />
              <SummaryCell label="App fees (50p/txn)" value={`−${formatPence(payout.app_fees_pence)}`} red />
              <SummaryCell label="Net to school" value={formatPence(payout.net_pence)} green />
            </div>
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 flex justify-between text-xs text-gray-500">
              <span>{matchedLines.length} matched transaction{matchedLines.length !== 1 ? "s" : ""}</span>
              {unmatchedLines.length > 0 ? (
                <span className="font-semibold text-red-600">⚠ {unmatchedLines.length} unmatched — review required</span>
              ) : (
                <span className="text-green-600 font-medium">✓ All transactions matched</span>
              )}
            </div>
          </div>

          {/* Unmatched transactions — prominent warning */}
          {unmatchedLines.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">
                ⚠ Unmatched balance transactions ({unmatchedLines.length})
              </h2>
              <p className="text-sm text-red-600 mb-3">
                These balance transactions exist in Stripe but could not be matched to any payment in School2Pay.
                Do not include them in net figures until they are identified.
              </p>
              <LineTable lines={unmatchedLines} unmatched />
            </section>
          )}

          {/* Matched transactions */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Matched payments ({matchedLines.length})
            </h2>
            {matchedLines.length === 0 ? (
              <p className="text-sm text-gray-400">No matched transactions.</p>
            ) : (
              <LineTable lines={matchedLines} unmatched={false} />
            )}
          </section>

          <p className="text-xs text-gray-400 text-center print:mt-8">
            Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
            Gross = parent-facing charge · Net = Stripe payout amount (canonical).
            App fees are 50p per matched card transaction.
          </p>
        </div>
      </main>
    </>
  );
}

function SummaryCell({
  label, value, red = false, green = false,
}: {
  label: string; value: string; red?: boolean; green?: boolean;
}) {
  return (
    <div className="p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-bold ${red ? "text-red-600" : green ? "text-green-700" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function LineTable({ lines, unmatched }: { lines: PayoutLine[]; unmatched: boolean }) {
  return (
    <div className={`rounded-xl border overflow-hidden ${unmatched ? "border-red-200" : "border-gray-200"}`}>
      <table className="w-full text-sm">
        <thead className={`border-b text-xs font-semibold uppercase tracking-wide ${
          unmatched ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50 border-gray-200 text-gray-500"
        }`}>
          <tr>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Description / Stripe ref</th>
            <th className="px-4 py-3 text-right">Gross</th>
            <th className="px-4 py-3 text-right">Stripe fee</th>
            <th className="px-4 py-3 text-right">App fee</th>
            <th className="px-4 py-3 text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  line.type === "charge" ? "bg-blue-100 text-blue-700" :
                  line.type === "refund" ? "bg-orange-100 text-orange-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {line.type}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">
                <div className="text-gray-700 truncate max-w-[260px]" title={line.description ?? ""}>
                  {line.description ?? "—"}
                </div>
                <div className="text-gray-400 font-mono">
                  {line.stripe_payment_intent_id ?? line.stripe_charge_id ?? line.stripe_balance_txn_id}
                </div>
                {!line.matched && line.type !== "payout" && (
                  <span className="text-red-600 font-medium">⚠ Not matched</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{formatPence(Math.abs(line.gross_pence))}</td>
              <td className="px-4 py-3 text-right font-mono text-red-600">
                {line.stripe_fee_pence > 0 ? `−${formatPence(line.stripe_fee_pence)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono text-red-600">
                {line.app_fee_pence > 0 ? `−${formatPence(line.app_fee_pence)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                {formatPence(line.net_pence)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Totals</td>
            <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
              {formatPence(Math.abs(lines.reduce((s, l) => s + l.gross_pence, 0)))}
            </td>
            <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">
              −{formatPence(lines.reduce((s, l) => s + l.stripe_fee_pence, 0))}
            </td>
            <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">
              −{formatPence(lines.reduce((s, l) => s + l.app_fee_pence, 0))}
            </td>
            <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">
              {formatPence(lines.reduce((s, l) => s + l.net_pence, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
