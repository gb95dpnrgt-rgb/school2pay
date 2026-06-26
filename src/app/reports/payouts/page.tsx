import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import { formatPence } from "@/lib/fees";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Payout = {
  id: string;
  stripe_payout_id: string;
  arrival_date: string;
  currency: string;
  gross_pence: number;
  stripe_fees_pence: number;
  app_fees_pence: number;
  net_pence: number;
  unmatched_count: number;
  status: string;
  description: string | null;
  created_at: string;
};

export default async function PayoutsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  const admin = getAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payouts } = await (admin.from("payouts") as any)
    .select("*")
    .eq("school_id", school?.id)
    .order("arrival_date", { ascending: false }) as { data: Payout[] | null };

  const totalNet = (payouts ?? []).reduce((s, p) => s + p.net_pence, 0);
  const totalGross = (payouts ?? []).reduce((s, p) => s + p.gross_pence, 0);
  const hasUnmatched = (payouts ?? []).some((p) => p.unmatched_count > 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/reports/payouts" className="text-sm font-medium text-gray-900">Payouts</a>
          <a href="/reports/summary" className="text-sm text-gray-500 hover:text-gray-800">Summary</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank payouts</h1>
            <p className="mt-1 text-sm text-gray-500">{school?.name}</p>
          </div>
          <a
            href="/api/export/payouts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            ↓ Export CSV
          </a>
        </div>

        {hasUnmatched && (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 px-5 py-4 flex gap-3">
            <span className="text-red-500 text-lg leading-none">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-800">Unmatched balance transactions</p>
              <p className="text-sm text-red-700 mt-0.5">
                One or more payouts contain balance transactions we could not match to a recorded payment.
                These are flagged below — review them before filing accounts.
              </p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        {payouts && payouts.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total gross collected</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{formatPence(totalGross)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total net paid to school</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{formatPence(totalNet)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payouts</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{payouts.length}</p>
            </div>
          </div>
        )}

        {!payouts || payouts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-500">No payouts received yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Payout records are created automatically when Stripe sends a <code>payout.paid</code> webhook.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Arrival date</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Stripe fees</th>
                  <th className="px-4 py-3 text-right">App fees</th>
                  <th className="px-4 py-3 text-right">Net to school</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr
                    key={payout.id}
                    className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                      payout.unmatched_count > 0 ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {new Date(payout.arrival_date).toLocaleDateString("en-GB", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </div>
                      {payout.description && (
                        <div className="text-xs text-gray-400">{payout.description}</div>
                      )}
                      {payout.unmatched_count > 0 && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-red-600">
                          ⚠ {payout.unmatched_count} unmatched transaction{payout.unmatched_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatPence(payout.gross_pence)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">−{formatPence(payout.stripe_fees_pence)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">−{formatPence(payout.app_fees_pence)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{formatPence(payout.net_pence)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/reports/payouts/${payout.id}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Detail →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          All amounts are shown in <strong>GBP</strong>.
          Gross = what parents paid · Net = gross minus Stripe fees minus School2Pay app fee (50p/transaction).
        </p>
      </div>
    </main>
  );
}
