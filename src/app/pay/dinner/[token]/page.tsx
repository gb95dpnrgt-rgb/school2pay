import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { verifyDinnerToken } from "@/lib/dinner-token";
import DinnerTopUpClient from "./DinnerTopUpClient";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function DinnerTopUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ topup?: string }>;
}) {
  const { token } = await params;
  const { topup } = await searchParams;

  let guardianId: string;
  let schoolId: string;
  try {
    const payload = await verifyDinnerToken(decodeURIComponent(token));
    guardianId = payload.guardianId;
    schoolId = payload.schoolId;
  } catch {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full text-center space-y-3">
          <p className="text-2xl">🔗</p>
          <h1 className="text-lg font-bold text-gray-900">Link expired</h1>
          <p className="text-sm text-gray-500">This top-up link has expired. Please contact your school for a new one.</p>
        </div>
      </main>
    );
  }

  const admin = getAdmin();

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, email")
    .eq("id", guardianId)
    .single() as { data: { id: string; email: string } | null };

  if (!guardian) notFound();

  const { data: school } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .single() as { data: { id: string; name: string } | null };

  if (!school) notFound();

  const { data: wallet } = await (admin.from("dinner_wallets") as any)
    .select("id, balance_pence")
    .eq("guardian_id", guardianId)
    .eq("school_id", schoolId)
    .maybeSingle() as { data: { id: string; balance_pence: number } | null };

  // Fetch last 5 transactions for this wallet
  const { data: history } = wallet
    ? await (admin.from("dinner_transactions") as any)
        .select("type, amount_pence, balance_after_pence, note, date, created_at")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(5) as {
          data: Array<{
            type: string;
            amount_pence: number;
            balance_after_pence: number;
            note: string | null;
            date: string;
            created_at: string;
          }> | null
        }
    : { data: null };

  // Fetch settings for this school
  const { data: settings } = await (admin.from("dinner_settings") as any)
    .select("price_per_meal_pence")
    .eq("school_id", schoolId)
    .maybeSingle() as { data: { price_per_meal_pence: number } | null };

  return (
    <DinnerTopUpClient
      token={token}
      schoolName={school.name}
      guardianEmail={guardian.email}
      balancePence={wallet?.balance_pence ?? 0}
      pricePerMealPence={settings?.price_per_meal_pence ?? 260}
      history={history ?? []}
      justToppedUp={topup === "success"}
    />
  );
}
