"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { signDinnerToken } from "@/lib/dinner-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://school2pay.vercel.app";

/** Generate a signed top-up link for a guardian */
export async function generateTopUpLink(formData: FormData): Promise<{ url: string }> {
  const guardianId = formData.get("guardian_id") as string;
  const schoolId = formData.get("school_id") as string;
  const token = await signDinnerToken(guardianId, schoolId);
  return { url: `${APP_URL}/pay/dinner/${encodeURIComponent(token)}` };
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getSchoolId() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: school } = await supabase.from("schools").select("id").single();
  if (!school) throw new Error("No school found");
  return school.id;
}

/** Mark meals taken for a list of students on a given date */
export async function recordMeals(formData: FormData) {
  const schoolId = await getSchoolId();
  const admin = getAdmin();
  const date = formData.get("date") as string;
  const studentIds = formData.getAll("student_id") as string[];

  if (!date || studentIds.length === 0) return;

  // Get dinner settings
  const { data: settings } = await (admin.from("dinner_settings") as any)
    .select("price_per_meal_pence")
    .eq("school_id", schoolId)
    .single() as { data: { price_per_meal_pence: number } | null };

  const pricePerMeal = settings?.price_per_meal_pence ?? 260;

  // Get FSM students — skip charging them
  const { data: fsmRows } = await (admin.from("fsm_students") as any)
    .select("student_id")
    .eq("school_id", schoolId)
    .or(`expires_at.is.null,expires_at.gte.${date}`) as { data: Array<{ student_id: string }> | null };

  const fsmSet = new Set((fsmRows ?? []).map((r) => r.student_id));

  // For each non-FSM student, find their guardian's wallet and deduct
  const billableStudentIds = studentIds.filter((id) => !fsmSet.has(id));

  if (billableStudentIds.length === 0) {
    revalidatePath("/dinner");
    return;
  }

  // Get guardian links for these students
  const { data: links } = await admin
    .from("guardian_student")
    .select("student_id, guardian_id")
    .in("student_id", billableStudentIds) as {
      data: Array<{ student_id: string; guardian_id: string }> | null
    };

  // Get or create wallets for each guardian
  const guardianIds = [...new Set((links ?? []).map((l) => l.guardian_id))];

  for (const guardianId of guardianIds) {
    // Get or create wallet
    let { data: wallet } = await (admin.from("dinner_wallets") as any)
      .select("id, balance_pence")
      .eq("guardian_id", guardianId)
      .eq("school_id", schoolId)
      .single() as { data: { id: string; balance_pence: number } | null };

    if (!wallet) {
      const { data: created } = await (admin.from("dinner_wallets") as any)
        .insert({ guardian_id: guardianId, school_id: schoolId, balance_pence: 0 })
        .select("id, balance_pence")
        .single();
      wallet = created;
    }

    if (!wallet) continue;

    // Count how many children this guardian has eating today
    const guardianStudents = (links ?? [])
      .filter((l) => l.guardian_id === guardianId && billableStudentIds.includes(l.student_id));

    for (const link of guardianStudents) {
      const deduction = -pricePerMeal;
      const balanceAfter = wallet.balance_pence + deduction;

      // Insert transaction (append-only)
      await (admin.from("dinner_transactions") as any).insert({
        wallet_id: wallet.id,
        student_id: link.student_id,
        type: "deduction",
        amount_pence: deduction,
        balance_after_pence: balanceAfter,
        note: `Meal taken ${date}`,
        date,
      });

      // Update wallet balance
      await (admin.from("dinner_wallets") as any)
        .update({ balance_pence: balanceAfter, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      wallet.balance_pence = balanceAfter;
    }
  }

  revalidatePath("/dinner");
}

/** Admin top-up a wallet manually (cash/cheque received) */
export async function adminTopUp(formData: FormData) {
  const schoolId = await getSchoolId();
  const admin = getAdmin();

  const guardianId = formData.get("guardian_id") as string;
  const amountPence = parseInt(formData.get("amount_pence") as string, 10);
  const note = (formData.get("note") as string) || "Manual top-up";

  if (!guardianId || !amountPence || amountPence <= 0) throw new Error("Invalid input");

  let { data: wallet } = await (admin.from("dinner_wallets") as any)
    .select("id, balance_pence")
    .eq("guardian_id", guardianId)
    .eq("school_id", schoolId)
    .single() as { data: { id: string; balance_pence: number } | null };

  if (!wallet) {
    const { data: created } = await (admin.from("dinner_wallets") as any)
      .insert({ guardian_id: guardianId, school_id: schoolId, balance_pence: 0 })
      .select("id, balance_pence")
      .single();
    wallet = created;
  }

  if (!wallet) throw new Error("Failed to get wallet");

  const balanceAfter = wallet.balance_pence + amountPence;

  await (admin.from("dinner_transactions") as any).insert({
    wallet_id: wallet.id,
    type: "adjustment",
    amount_pence: amountPence,
    balance_after_pence: balanceAfter,
    note,
    date: new Date().toISOString().slice(0, 10),
  });

  await (admin.from("dinner_wallets") as any)
    .update({ balance_pence: balanceAfter, updated_at: new Date().toISOString() })
    .eq("id", wallet.id);

  revalidatePath("/dinner");
}

/** Save dinner money settings */
export async function saveDinnerSettings(formData: FormData) {
  const schoolId = await getSchoolId();
  const admin = getAdmin();

  const pricePerMeal = parseInt(formData.get("price_per_meal_pence") as string, 10);
  const lowBalanceThreshold = parseInt(formData.get("low_balance_threshold_pence") as string, 10);

  if (!pricePerMeal || pricePerMeal <= 0) throw new Error("Invalid meal price");

  await (admin.from("dinner_settings") as any).upsert({
    school_id: schoolId,
    price_per_meal_pence: pricePerMeal,
    low_balance_threshold_pence: lowBalanceThreshold || 500,
    updated_at: new Date().toISOString(),
  }, { onConflict: "school_id" });

  revalidatePath("/dinner");
}

/** Mark/unmark a student as FSM */
export async function toggleFsm(formData: FormData) {
  const schoolId = await getSchoolId();
  const admin = getAdmin();
  const studentId = formData.get("student_id") as string;
  const action = formData.get("action") as string;

  if (action === "add") {
    await (admin.from("fsm_students") as any).upsert({
      student_id: studentId,
      school_id: schoolId,
      expires_at: null,
    }, { onConflict: "student_id" });
  } else {
    await (admin.from("fsm_students") as any)
      .delete()
      .eq("student_id", studentId)
      .eq("school_id", schoolId);
  }

  revalidatePath("/dinner");
}
