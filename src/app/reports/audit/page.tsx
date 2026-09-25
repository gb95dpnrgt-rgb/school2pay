import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import type { Database } from "@/lib/supabase/types";
import AuditExportForm from "./AuditExportForm";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  const admin = getAdmin();

  // Fetch recent ledger entries for preview (last 50)
  const { data: entries } = await (admin as any)
    .from("ledger_entries")
    .select(`
      id, account, debit_pence, credit_pence, created_at,
      transactions!inner(
        id, amount_pence, status,
        transaction_lines(
          amount_pence,
          assignments!inner(
            payment_requests!inner(title, school_id)
          )
        )
      )
    `)
    .eq("transactions.transaction_lines.assignments.payment_requests.school_id", school?.id)
    .order("created_at", { ascending: false })
    .limit(50) as {
      data: Array<{
        id: string;
        account: string;
        debit_pence: number;
        credit_pence: number;
        created_at: string;
        transactions: {
          id: string;
          amount_pence: number;
          status: string;
          transaction_lines: Array<{
            amount_pence: number;
            assignments: { payment_requests: { title: string; school_id: string } };
          }>;
        };
      }> | null;
    };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/reports/export" className="text-sm text-gray-500 hover:text-gray-800">Reports</a>
          <a href="/reports/audit" className="text-sm font-medium text-gray-900">Audit</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit pack</h1>
          <p className="mt-1 text-sm text-gray-500">{school?.name} · Append-only ledger for school fund audits</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">About the ledger</p>
          <p>
            The ledger is append-only — entries are never edited or deleted.
            Each transaction generates a debit to <code className="bg-amber-100 px-1 rounded">receivable</code> and a credit to <code className="bg-amber-100 px-1 rounded">income</code>.
            Refunds add reversing entries. This CSV is suitable for submission to your school fund auditor.
          </p>
        </div>

        <AuditExportForm schoolId={school?.id ?? ""} />

        {/* Preview of recent entries */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent ledger entries (preview — last 50)</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-right">Debit (gross)</th>
                  <th className="px-4 py-3 text-right">Credit (gross)</th>
                  <th className="px-4 py-3 text-left">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(entries ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No ledger entries yet.</td>
                  </tr>
                ) : (entries ?? []).map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.account === "income" ? "bg-green-100 text-green-700" :
                        entry.account === "receivable" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {entry.account}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                      {entry.debit_pence > 0 ? `£${(entry.debit_pence / 100).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                      {entry.credit_pence > 0 ? `£${(entry.credit_pence / 100).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono truncate max-w-[160px]">
                      {entry.transactions?.id?.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
