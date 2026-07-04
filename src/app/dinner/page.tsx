import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as adminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import DinnerTabs from "./DinnerTabs";

function pence(n: number) {
  return `£${(n / 100).toFixed(2)}`;
}

export type DinnerStudent = {
  id: string;
  first_name: string;
  year_group: string;
  is_fsm: boolean;
};

export type WalletRow = {
  id: string;
  balance_pence: number;
  guardian: { id: string; email: string; phone: string | null };
  students: string[];
};

export type DinnerSettings = {
  price_per_meal_pence: number;
  low_balance_threshold_pence: number;
};

export default async function DinnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();
  if (!school) redirect("/login");

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const schoolId = school.id;

  // Fetch all students + FSM status
  const { data: studentsRaw } = await supabase
    .from("students")
    .select("id, first_name, year_group")
    .order("year_group")
    .order("first_name");

  const { data: fsmRaw } = await (admin.from("fsm_students") as any)
    .select("student_id")
    .eq("school_id", schoolId) as { data: Array<{ student_id: string }> | null };

  const fsmSet = new Set((fsmRaw ?? []).map((r) => r.student_id));

  const students: DinnerStudent[] = (studentsRaw ?? []).map((s) => ({
    ...s,
    is_fsm: fsmSet.has(s.id),
  }));

  // Fetch wallets with guardian info
  const { data: walletsRaw } = await (admin.from("dinner_wallets") as any)
    .select("id, balance_pence, guardian_id")
    .eq("school_id", schoolId)
    .order("balance_pence") as {
      data: Array<{ id: string; balance_pence: number; guardian_id: string }> | null
    };

  // Fetch guardians for those wallets
  const guardianIds = (walletsRaw ?? []).map((w) => w.guardian_id);
  const { data: guardiansRaw } = guardianIds.length
    ? await admin.from("guardians").select("id, email, phone").in("id", guardianIds)
    : { data: [] };

  // Map guardian → students
  const { data: guardianLinks } = await admin
    .from("guardian_student")
    .select("guardian_id, student_id, students(first_name)")
    .in("guardian_id", guardianIds.length ? guardianIds : ["00000000-0000-0000-0000-000000000000"]) as {
      data: Array<{ guardian_id: string; student_id: string; students: { first_name: string } | null }> | null
    };

  const guardianMap = new Map((guardiansRaw ?? []).map((g) => [g.id, g]));
  const linksByGuardian = new Map<string, string[]>();
  for (const link of (guardianLinks ?? [])) {
    const name = (link.students as any)?.first_name ?? "Unknown";
    if (!linksByGuardian.has(link.guardian_id)) linksByGuardian.set(link.guardian_id, []);
    linksByGuardian.get(link.guardian_id)!.push(name);
  }

  const wallets: WalletRow[] = (walletsRaw ?? []).map((w) => ({
    id: w.id,
    balance_pence: w.balance_pence,
    guardian: guardianMap.get(w.guardian_id) ?? { id: w.guardian_id, email: "Unknown", phone: null },
    students: linksByGuardian.get(w.guardian_id) ?? [],
  }));

  // Fetch settings
  const { data: settingsRaw } = await (admin.from("dinner_settings") as any)
    .select("price_per_meal_pence, low_balance_threshold_pence")
    .eq("school_id", schoolId)
    .single() as { data: DinnerSettings | null };

  const settings: DinnerSettings = settingsRaw ?? {
    price_per_meal_pence: 260,
    low_balance_threshold_pence: 500,
  };

  const lowBalanceCount = wallets.filter(
    (w) => w.balance_pence < settings.low_balance_threshold_pence && w.balance_pence >= 0
  ).length;
  const negativeCount = wallets.filter((w) => w.balance_pence < 0).length;

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/dinner" className="text-sm font-medium text-gray-900">Dinner Money</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dinner Money</h1>
            <p className="mt-1 text-sm text-gray-500">{school.name}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-500">Meal price: <span className="font-semibold text-gray-900">{pence(settings.price_per_meal_pence)}</span></p>
          </div>
        </div>

        {/* Alert banners */}
        {negativeCount > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
            <span className="text-red-500 text-lg">⚠️</span>
            <p className="text-sm text-red-800 font-medium">
              {negativeCount} {negativeCount === 1 ? "wallet is" : "wallets are"} in negative balance — contact the parent to top up
            </p>
          </div>
        )}
        {lowBalanceCount > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
            <span className="text-amber-500 text-lg">⚡</span>
            <p className="text-sm text-amber-800 font-medium">
              {lowBalanceCount} {lowBalanceCount === 1 ? "wallet is" : "wallets are"} below the low balance threshold ({pence(settings.low_balance_threshold_pence)})
            </p>
          </div>
        )}

        <DinnerTabs
          students={students}
          wallets={wallets}
          settings={settings}
          schoolId={schoolId}
        />
      </div>
    </main>
  );
}
