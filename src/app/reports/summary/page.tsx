import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import { formatPence } from "@/lib/fees";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type SummaryRow = {
  month: string;
  payment_request_id: string;
  request_title: string;
  total_students: number;
  paid_count: number;
  waived_count: number;
  gross_collected_pence: number;
  net_collected_pence: number;
};

export default async function SummaryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (admin as any).rpc("monthly_collection_summary", {
    p_school_id: school?.id,
  }) as { data: SummaryRow[] | null };

  // Group by month for display
  const byMonth = new Map<string, SummaryRow[]>();
  for (const row of rows ?? []) {
    if (!byMonth.has(row.month)) byMonth.set(row.month, []);
    byMonth.get(row.month)!.push(row);
  }

  const totalGross = (rows ?? []).reduce((s, r) => s + Number(r.gross_collected_pence), 0);
  const totalNet = (rows ?? []).reduce((s, r) => s + Number(r.net_collected_pence), 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/reports/payouts" className="text-sm text-gray-500 hover:text-gray-800">Payouts</a>
          <a href="/reports/summary" className="text-sm font-medium text-gray-900">Summary</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Monthly collection summary</h1>
            <p className="mt-1 text-sm text-gray-500">{school?.name}</p>
          </div>
          <a
            href="/api/export/summary"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            ↓ Export CSV
          </a>
        </div>

        {/* Grand totals */}
        {rows && rows.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total gross collected (all time)</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{formatPence(totalGross)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total estimated net (all time)</p>
              <p className="mt-1 text-2xl font-bold text-green-700">{formatPence(totalNet)}</p>
              <p className="text-xs text-gray-400">After Stripe fees and 50p/txn app fee</p>
            </div>
          </div>
        )}

        {!rows || rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-500">No completed payments yet</p>
            <p className="mt-1 text-xs text-gray-400">
              This report shows collections once Stripe webhooks confirm payment.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {[...byMonth.entries()].map(([month, monthRows]) => {
              const monthGross = monthRows.reduce((s, r) => s + Number(r.gross_collected_pence), 0);
              const monthNet = monthRows.reduce((s, r) => s + Number(r.net_collected_pence), 0);
              const [year, mo] = month.split("-");
              const monthLabel = new Date(Number(year), Number(mo) - 1).toLocaleDateString("en-GB", {
                month: "long", year: "numeric",
              });

              return (
                <section key={month}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-gray-800">{monthLabel}</h2>
                    <span className="text-xs text-gray-500">
                      {formatPence(monthGross)} gross · {formatPence(monthNet)} est. net
                    </span>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-3 text-left">Payment request</th>
                          <th className="px-4 py-3 text-right">Students</th>
                          <th className="px-4 py-3 text-right">Paid</th>
                          <th className="px-4 py-3 text-right">Waived</th>
                          <th className="px-4 py-3 text-right">Gross collected</th>
                          <th className="px-4 py-3 text-right">Est. net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthRows.map((row) => (
                          <tr key={row.payment_request_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              <a
                                href={`/requests/${row.payment_request_id}`}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {row.request_title}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{Number(row.total_students)}</td>
                            <td className="px-4 py-3 text-right text-green-700 font-medium">{Number(row.paid_count)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{Number(row.waived_count)}</td>
                            <td className="px-4 py-3 text-right font-mono text-gray-700">
                              {formatPence(Number(row.gross_collected_pence))}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-green-700">
                              {formatPence(Number(row.net_collected_pence))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Month total</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                            {formatPence(monthGross)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-green-700">
                            {formatPence(monthNet)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          <strong>Gross</strong> = what parents paid.{" "}
          <strong>Est. net</strong> = gross minus estimated Stripe processing fee (1.5% + 20p) minus School2Pay app fee (50p) per transaction.
          For exact net figures use the <a href="/reports/payouts" className="underline">Payouts report</a>.
        </p>
      </div>
    </main>
  );
}
