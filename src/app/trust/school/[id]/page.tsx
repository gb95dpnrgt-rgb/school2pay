import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";

function pence(n: number) { return `£${(n / 100).toFixed(2)}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

export default async function TrustSchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify trust admin and that school belongs to their trust
  const { data: trustAdmin } = await (admin.from("trust_admin_users") as any)
    .select("trust_id, trusts(legal_name)")
    .eq("auth_user_id", user.id)
    .single() as { data: { trust_id: string; trusts: { legal_name: string } | null } | null };

  if (!trustAdmin) redirect("/dashboard");

  const { data: school } = await admin
    .from("schools")
    .select("id, name, urn, trust_id")
    .eq("id", schoolId)
    .eq("trust_id", trustAdmin.trust_id)
    .single() as { data: { id: string; name: string; urn: string | null; trust_id: string } | null };

  if (!school) notFound();

  const trustName = (trustAdmin.trusts as any)?.legal_name ?? "";

  // Fetch school data in parallel
  const [
    { data: students },
    { data: requests },
    { data: assignments },
    { data: wallets },
    { data: dinnerSettings },
    { data: clubs },
    { data: enrollments },
  ] = await Promise.all([
    admin.from("students").select("id, first_name, year_group").eq("school_id", schoolId).order("year_group").order("first_name"),
    admin.from("payment_requests").select("id, title, amount_pence, due_date, status").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(10),
    admin.from("assignments").select("amount_due_pence, amount_paid_pence, status, payment_requests!inner(school_id, status)").eq("payment_requests.school_id", schoolId) as Promise<{ data: Array<{ amount_due_pence: number; amount_paid_pence: number; status: string; payment_requests: { school_id: string; status: string } }> | null }>,
    (admin.from("dinner_wallets") as any).select("id, balance_pence, guardian_id").eq("school_id", schoolId) as Promise<{ data: Array<{ id: string; balance_pence: number; guardian_id: string }> | null }>,
    (admin.from("dinner_settings") as any).select("price_per_meal_pence, low_balance_threshold_pence").eq("school_id", schoolId).maybeSingle() as Promise<{ data: { price_per_meal_pence: number; low_balance_threshold_pence: number } | null }>,
    (admin.from("clubs") as any).select("id, name, status, fee_pence, fee_model, sessions_per_term").eq("school_id", schoolId) as Promise<{ data: Array<{ id: string; name: string; status: string; fee_pence: number; fee_model: string; sessions_per_term: number | null }> | null }>,
    (admin.from("club_enrollments") as any).select("club_id, status, payment_status").in("club_id", []) as Promise<{ data: [] }>,
  ]);

  const threshold = dinnerSettings?.low_balance_threshold_pence ?? 500;
  const openAssignments = (assignments ?? []).filter((a) => (a.payment_requests as any).status === "open");
  const totalCollected = openAssignments.reduce((s, a) => s + a.amount_paid_pence, 0);
  const totalOutstanding = openAssignments.filter((a) => a.status !== "paid" && a.status !== "waived").reduce((s, a) => s + (a.amount_due_pence - a.amount_paid_pence), 0);
  const negativeWallets = (wallets ?? []).filter((w) => w.balance_pence < 0);
  const lowWallets = (wallets ?? []).filter((w) => w.balance_pence >= 0 && w.balance_pence < threshold);

  // Fetch club enrollment counts
  const clubIds = (clubs ?? []).map((c) => c.id);
  const { data: clubEnrollments } = clubIds.length
    ? await (admin.from("club_enrollments") as any).select("club_id, status").in("club_id", clubIds).eq("status", "enrolled") as Promise<{ data: Array<{ club_id: string; status: string }> | null }>
    : { data: [] };

  const enrollmentCounts = new Map<string, number>();
  for (const e of clubEnrollments ?? []) {
    enrollmentCounts.set(e.club_id, (enrollmentCounts.get(e.club_id) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/trust/dashboard" className="text-sm text-gray-500 hover:text-gray-800">{trustName}</a>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-900">{school.name}</span>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          {school.urn && <p className="text-sm text-gray-400 mt-0.5">URN {school.urn}</p>}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pupils</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{students?.length ?? 0}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Collected</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{pence(totalCollected)}</p>
            <p className="text-xs text-gray-400">open requests</p>
          </div>
          <div className={`rounded-xl border p-4 ${totalOutstanding > 0 ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding</p>
            <p className={`mt-1 text-xl font-bold ${totalOutstanding > 0 ? "text-amber-700" : "text-gray-900"}`}>{pence(totalOutstanding)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${negativeWallets.length > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Neg. wallets</p>
            <p className={`mt-1 text-xl font-bold ${negativeWallets.length > 0 ? "text-red-600" : "text-gray-900"}`}>{negativeWallets.length}</p>
          </div>
        </div>

        {/* Payment requests */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent payment requests</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(requests ?? []).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                    <td className="px-4 py-3 text-gray-500">{r.due_date ? fmtDate(r.due_date) : "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{pence(r.amount_pence)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(requests ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No payment requests yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Clubs */}
        {(clubs ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Clubs</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Club</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Enrolled</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(clubs ?? []).map((c) => {
                    const totalFee = c.fee_model === "weekly" ? c.fee_pence * (c.sessions_per_term ?? 1) : c.fee_pence;
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-4 py-3 text-gray-600">{enrollmentCounts.get(c.id) ?? 0}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{pence(totalFee)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Dinner wallets flagged */}
        {(negativeWallets.length > 0 || lowWallets.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dinner money alerts</h2>
            <div className="space-y-2">
              {negativeWallets.map((w) => (
                <div key={w.id} className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex justify-between text-sm">
                  <span className="text-red-800 font-medium">Negative wallet</span>
                  <span className="text-red-600 font-bold tabular-nums">{pence(w.balance_pence)}</span>
                </div>
              ))}
              {lowWallets.map((w) => (
                <div key={w.id} className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex justify-between text-sm">
                  <span className="text-amber-800 font-medium">Low balance</span>
                  <span className="text-amber-600 font-bold tabular-nums">{pence(w.balance_pence)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
