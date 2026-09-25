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

type GuardianRow = {
  guardianId: string;
  email: string;
  totalOwedPence: number;
  items: Array<{ requestTitle: string; studentName: string; amountPence: number }>;
};

export default async function OutstandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();
  if (!school) redirect("/login");

  const admin = getAdmin();

  // All unpaid/partial assignments for this school with guardian links
  const { data: assignments } = await admin
    .from("assignments")
    .select(`
      id, amount_due_pence, amount_paid_pence,
      students!inner(
        first_name, year_group, school_id,
        guardian_student(
          guardians(id, email)
        )
      ),
      payment_requests!inner(id, title, status, school_id)
    `)
    .in("status", ["unpaid", "partial"]) as {
      data: Array<{
        id: string;
        amount_due_pence: number;
        amount_paid_pence: number;
        students: {
          first_name: string;
          year_group: string;
          school_id: string;
          guardian_student: Array<{
            guardians: { id: string; email: string } | null;
          }>;
        };
        payment_requests: { id: string; title: string; status: string; school_id: string };
      }> | null;
    };

  // Filter to this school, open requests only
  const filtered = (assignments ?? []).filter(
    (a) =>
      a.students.school_id === school.id &&
      a.payment_requests.school_id === school.id &&
      a.payment_requests.status === "open"
  );

  // Group by guardian
  const byGuardian = new Map<string, GuardianRow>();
  for (const asgn of filtered) {
    const outstanding = asgn.amount_due_pence - asgn.amount_paid_pence;
    if (outstanding <= 0) continue;
    for (const link of asgn.students.guardian_student) {
      const g = link.guardians;
      if (!g) continue;
      if (!byGuardian.has(g.id)) {
        byGuardian.set(g.id, { guardianId: g.id, email: g.email, totalOwedPence: 0, items: [] });
      }
      const row = byGuardian.get(g.id)!;
      row.totalOwedPence += outstanding;
      row.items.push({
        requestTitle: asgn.payment_requests.title,
        studentName: `${asgn.students.first_name} (Yr ${asgn.students.year_group})`,
        amountPence: outstanding,
      });
    }
  }

  const guardians = [...byGuardian.values()].sort((a, b) => b.totalOwedPence - a.totalOwedPence);
  const totalOutstanding = guardians.reduce((s, g) => s + g.totalOwedPence, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/reports" className="text-sm text-gray-500 hover:text-gray-800">Reports</a>
          <a href="/reports/outstanding" className="text-sm font-medium text-gray-900">Outstanding</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outstanding balances</h1>
            <p className="mt-1 text-sm text-gray-500">{school.name} · Open requests only</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-right">
            <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Total outstanding</p>
            <p className="text-2xl font-bold text-red-700">{formatPence(totalOutstanding)}</p>
            <p className="text-xs text-red-500 mt-0.5">{guardians.length} parent{guardians.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {guardians.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm font-medium text-gray-700">All paid up!</p>
            <p className="text-xs text-gray-400 mt-1">No outstanding balances on open requests.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Parent / guardian</th>
                  <th className="px-4 py-3 text-left">What they owe</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {guardians.map((g) => (
                  <tr key={g.guardianId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{g.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {g.items.map((item, i) => (
                          <div key={i} className="text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{item.studentName}</span>
                            {" — "}{item.requestTitle}
                            <span className="ml-1.5 font-mono text-gray-600">
                              £{(item.amountPence / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">
                      {formatPence(g.totalOwedPence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Sorted by amount owed (largest first). Use the reminder button on each payment request to chase individual parents.
        </p>
      </div>
    </main>
  );
}
