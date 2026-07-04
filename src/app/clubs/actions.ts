"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { signClubToken } from "@/lib/club-token";
import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://school2pay.vercel.app";
const resend = new Resend(process.env.RESEND_API_KEY);

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

export async function createClub(formData: FormData) {
  const schoolId = await getSchoolId();
  const admin = getAdmin();

  const feeModel = formData.get("fee_model") as string;
  const feePence = Math.round(parseFloat(formData.get("fee_pence") as string) * 100);
  const sessionsPerTerm = feeModel === "weekly"
    ? parseInt(formData.get("sessions_per_term") as string, 10)
    : null;
  const maxCapacity = formData.get("max_capacity")
    ? parseInt(formData.get("max_capacity") as string, 10)
    : null;

  const { data: club, error } = await (admin.from("clubs") as any).insert({
    school_id: schoolId,
    name: formData.get("name") as string,
    description: formData.get("description") as string || null,
    fee_model: feeModel,
    fee_pence: feePence,
    sessions_per_term: sessionsPerTerm,
    day_of_week: formData.get("day_of_week") as string || null,
    start_date: formData.get("start_date") as string || null,
    end_date: formData.get("end_date") as string || null,
    max_capacity: maxCapacity,
    status: "open",
  }).select("id").single() as { data: { id: string } | null; error: unknown };

  if (error || !club) throw new Error("Failed to create club");

  revalidatePath("/clubs");
}

export async function updateClubStatus(formData: FormData) {
  await getSchoolId();
  const admin = getAdmin();
  const clubId = formData.get("club_id") as string;
  const status = formData.get("status") as string;

  await (admin.from("clubs") as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", clubId);

  revalidatePath("/clubs");
}

export async function getSignUpLink(formData: FormData): Promise<{ url: string }> {
  const clubId = formData.get("club_id") as string;
  const schoolId = formData.get("school_id") as string;
  const token = await signClubToken(clubId, schoolId);
  return { url: `${APP_URL}/clubs/signup/${encodeURIComponent(token)}` };
}

export async function cancelEnrollment(formData: FormData) {
  await getSchoolId();
  const admin = getAdmin();
  const enrollmentId = formData.get("enrollment_id") as string;
  const clubId = formData.get("club_id") as string;

  await (admin.from("club_enrollments") as any)
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);

  // Promote first waitlisted student if any
  const { data: waitlisted } = await (admin.from("club_enrollments") as any)
    .select("id, guardian_id, student_id, students(first_name)")
    .eq("club_id", clubId)
    .eq("status", "waitlisted")
    .order("waitlist_position", { ascending: true })
    .limit(1) as {
      data: Array<{ id: string; guardian_id: string; student_id: string; students: { first_name: string } }> | null
    };

  if (waitlisted?.length) {
    const next = waitlisted[0];
    await (admin.from("club_enrollments") as any)
      .update({
        status: "enrolled",
        waitlist_position: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", next.id);

    // Email the guardian
    const { data: guardian } = await admin
      .from("guardians")
      .select("email")
      .eq("id", next.guardian_id)
      .single() as { data: { email: string } | null };

    const { data: club } = await (admin.from("clubs") as any)
      .select("name, school_id, schools(name)")
      .eq("id", clubId)
      .single() as { data: { name: string; schools: { name: string } | null } | null };

    if (guardian?.email && club) {
      const schoolName = (club.schools as any)?.name ?? "your school";
      const signUpToken = await signClubToken(clubId, formData.get("school_id") as string);
      const link = `${APP_URL}/clubs/signup/${encodeURIComponent(signUpToken)}`;

      await resend.emails.send({
        from: "School2Pay <noreply@school2pay.com>",
        to: guardian.email,
        subject: `A place is available — ${club.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#111827">A place is now available!</h2>
            <p style="color:#6b7280">A space has opened up in <strong>${club.name}</strong> at <strong>${schoolName}</strong>.</p>
            <p style="color:#6b7280">Your child <strong>${next.students.first_name}</strong> has been moved from the waiting list to enrolled.</p>
            <a href="${link}" style="display:inline-block;margin-top:16px;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Complete enrolment &amp; pay</a>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px">School2Pay · school2pay.com</p>
          </div>
        `,
      });
    }
  }

  revalidatePath("/clubs");
}
