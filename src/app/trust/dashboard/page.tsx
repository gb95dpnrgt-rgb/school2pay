import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`;
}

type SchoolStats = {
  id: string;
  name: string;
  urn: string | null;
  studentCount: number;
  openRequestCount: number;
  collectedPence: number;
  outstandingPence: number;
  negativeWallets: number;
  lowWallets: number;
  openClubs: number;
};

export default async function TrustDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Verify trust admin
  const { data: trustAdmin } = await (admin.from("trust_admin_users") as any)
    .select("trust_id, trusts(id, legal_name, stripe_account_id)")
    .eq("auth_user_id", user.id)
    .single() as {
      data: {
        trust_id: string;
        trusts: { id: string; legal_name: string; stripe_account_id: string | null } | null;
      } | null
    };

  if (!trustAdmin) redirect("/dashboard");

  const trust = trustAdmin.trusts as { id: string; legal_name: string; stripe_account_id: string | null };
  const trustId = trust.id;

  // Get all schools in this trust
  const { data: schools } = await admin
    .from("schools")
    .select("id, name, urn")
    .eq("trust_id", trustId)
    .order("name") as { data: Array<{ id: string; name: string; urn: string | null }> | null };

  const schoolIds = (schools ?? []).map((s) => s.id);

  if (schoolIds.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50">
        <TrustNav trustName={trust.legal_name} />
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <p className="text-gray-500">No schools are linked to this trust yet.</p>
        </div>
      </main>
    );
  }

  // Fetch all data in parallel
  const [
    { data: students },
    { data: assignments },
    { data: wallets },
    { data: dinnerSettings },
    { data: clubs },
  ] = await Promise.all([
    admin.from("students").select("id, school_id").in("school_id", schoolIds),
    admin.from("assignments")
      .select("amount_due_pence, amount_paid_pence, status, payment_requests!inner(school_id, status)")
      .in("payment_requests.school_id", schoolIds) as Promise<{
        data: Array<{
          amount_due_pence: number;
          amount_paid_pence: number;
          status: string;
          payment_requests: { school_id: string; status: string };
        }> | null
      }>,
    (admin.from("dinner_wallets") as any)
      .select("school_id, balance_pence")
      .in("school_id", schoolIds) as Promise<{ data: Array<{ school_id: string; balance_pence: number }> | null }>,
    (admin.from("dinner_settings") as any)
      .select("school_id, low_balance_threshold_pence")
      .in("school_id", schoolIds) as Promise<{ data: Array<{ school_id: string; low_balance_threshold_pence: number }> | null }>,
    (admin.from("clubs") as any)
      .select("school_id, status")
      .in("school_id", schoolIds) as Promise<{ data: Array<{ school_id: string; status: string }> | null }>,
  ]);

  const thresholdMap = new Map((dinnerSettings ?? []).map((s) => [s.school_id, s.low_balance_threshold_pence]));

  // Build per-school stats
  const stats: SchoolStats[] = (schools ?? []).map((school) => {
    const schoolStudents = (students ?? []).filter((s) => s.school_id === school.id);

    const openAssignments = (assignments ?? []).filter(
      (a) => (a.payment_requests as any).school_id === school.id &&
              (a.payment_requests as any).status === "open"
    );
    const openRequestIds = new Set(openAssignments.map((a) => (a.payment_requests as any).school_id));

    const collected = openAssignments.reduce((s, a) => s + a.amount_paid_pence, 0);
    const outstanding = openAssignments
      .filter((a) => a.status === "unpaid" || a.status === "partial")
      .reduce((s, a) => s + (a.amount_due_pence - a.amount_paid_pence), 0);

    const uniqueRequestIds = new Set(openAssignments.map((a) => JSON.stringify(a.payment_requests)));

    const schoolWallets = (wallets ?? []).filter((w) => w.school_id === school.id);
    const threshold = thresholdMap.get(school.id) ?? 500;
    const negativeWallets = schoolWallets.filter((w) => w.balance_pence < 0).length;
    const lowWallets = schoolWallets.filter((w) => w.balance_pence >= 0 && w.balance_pence < threshold).length;

    const openClubs = (clubs ?? []).filter((c) => c.school_id === school.id && c.status === "open").length;

    return {
      id: school.id,
      name: school.name,
      urn: school.urn,
      studentCount: schoolStudents.length,
      openRequestCount: uniqueRequestIds.size,
      collectedPence: collected,
      outstandingPence: outstanding,
      negativeWallets,
      lowWallets,
      openClubs,
    };
  });

  // Trust-wide totals
  const totalCollected = stats.reduce((s, sc) => s + sc.collectedPence, 0);
  const totalOutstanding = stats.reduce((s, sc) => s + sc.outstandingPence, 0);
  const totalStudents = stats.reduce((s, sc) => s + sc.studentCount, 0);
  const totalNegative = stats.reduce((s, sc) => s + sc.negativeWallets, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <TrustNav trustName={trust.legal_name} />

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{trust.legal_name}</h1>
          <p className="text-sm text-gray-500 mt-1">{schools?.length} schools · {totalStudents} pupils</p>
        </div>

        {/* Trust-wide KPIs */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total collected" value={pence(totalCollected)} sub="open requests" />
          <KpiCard label="Outstanding" value={pence(totalOutstanding)} sub="open requests" highlight={totalOutstanding > 0} />
          <KpiCard label="Schools" value={String(schools?.length ?? 0)} />
          <KpiCard label="Negative wallets" value={String(totalNegative)} highlight={totalNegative > 0} sub="dinner money" />
        </div>

        {/* Alerts */}
        {totalNegative > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
            <span className="text-red-500">⚠️</span>
            <p className="text-sm text-red-800 font-medium">
              {totalNegative} dinner wallet{totalNegative !== 1 ? "s" : ""} in negative balance across the trust
            </p>
          </div>
        )}

        {/* School cards */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Schools</h2>
          {stats.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </section>
      </div>
    </main>
  );
}

function TrustNav({ trustName }: { trustName: string }) {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-gray-900">School2Pay</span>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-900">{trustName}</span>
      </div>
      <form action={logout}>
        <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
      </form>
    </nav>
  );
}

function KpiCard({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SchoolCard({ school }: { school: SchoolStats }) {
  const hasIssues = school.negativeWallets > 0 || school.lowWallets > 0;

  return (
    <a
      href={`/trust/school/${school.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{school.name}</h3>
            {school.urn && <span className="text-xs text-gray-400">URN {school.urn}</span>}
          </div>
          <p className="text-sm text-gray-500">{school.studentCount} pupils · {school.openRequestCount} open requests · {school.openClubs} clubs</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-gray-900">£{(school.collectedPence / 100).toFixed(2)} collected</p>
          {school.outstandingPence > 0 && (
            <p className="text-xs text-amber-600">£{(school.outstandingPence / 100).toFixed(2)} outstanding</p>
          )}
        </div>
      </div>

      {hasIssues && (
        <div className="mt-3 flex gap-2">
          {school.negativeWallets > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {school.negativeWallets} negative wallet{school.negativeWallets !== 1 ? "s" : ""}
            </span>
          )}
          {school.lowWallets > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {school.lowWallets} low balance{school.lowWallets !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </a>
  );
}
