import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { formatPence } from "@/lib/fees";

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  // Fetch requests with assignment aggregates
  const { data: requests } = await supabase
    .from("payment_requests")
    .select(`
      id, title, due_date, amount_pence, year_groups, status, created_at,
      assignments ( amount_due_pence, amount_paid_pence, status )
    `)
    .order("created_at", { ascending: false }) as {
      data: Array<{
        id: string;
        title: string;
        due_date: string;
        amount_pence: number;
        year_groups: string[] | null;
        status: string;
        created_at: string;
        assignments: Array<{
          amount_due_pence: number;
          amount_paid_pence: number;
          status: string;
        }>;
      }> | null;
    };

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm font-medium text-gray-900">Requests</a>
          <a href="/students" className="text-sm text-gray-500 hover:text-gray-800">Students</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment requests</h1>
            <p className="mt-1 text-sm text-gray-500">{school?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/export/requests"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              ↓ Export CSV
            </a>
            <a
              href="/requests/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + New request
            </a>
          </div>
        </div>

        {!requests || requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-500">No payment requests yet</p>
            <a href="/requests/new" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Create your first request →
            </a>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-right">Gross / pupil</th>
                  <th className="px-4 py-3 text-right">Collected (gross)</th>
                  <th className="px-4 py-3 text-right">Expected (gross)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const assignments = req.assignments ?? [];
                  const studentCount = assignments.length;
                  const collectedGross = assignments
                    .filter((a) => a.status === "paid")
                    .reduce((sum, a) => sum + a.amount_due_pence, 0);
                  const expectedGross = assignments.reduce((sum, a) => sum + a.amount_due_pence, 0);
                  const paidCount = assignments.filter((a) => a.status === "paid").length;

                  const progressPct = expectedGross > 0
                    ? Math.round((collectedGross / expectedGross) * 100)
                    : 0;

                  return (
                    <tr key={req.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <a href={`/requests/${req.id}`} className="hover:text-blue-600 hover:underline">
                          {req.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(req.due_date).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {req.year_groups ? req.year_groups.join(", ") : "Whole school"}
                        <span className="ml-1 text-gray-400">({studentCount})</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {formatPence(req.amount_pence)}
                        <span className="block text-xs text-gray-400 font-sans">gross</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="text-green-700">{formatPence(collectedGross)}</span>
                        <span className="block text-xs text-gray-400 font-sans">{paidCount}/{studentCount} paid</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {formatPence(expectedGross)}
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-400"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          req.status === "open"
                            ? "bg-green-100 text-green-700"
                            : req.status === "closed"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          All amounts shown are <strong>gross</strong> (what parents pay).{" "}
          <a href="/fees" className="underline hover:text-gray-600">See how fees work →</a>
        </p>
      </div>
    </main>
  );
}
