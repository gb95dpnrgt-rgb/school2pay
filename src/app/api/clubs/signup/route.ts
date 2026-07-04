import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { verifyClubToken } from "@/lib/club-token";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://school2pay.vercel.app";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { token: string; email: string; studentId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token, email, studentId } = body;

  if (!email || !studentId) {
    return NextResponse.json({ error: "Email and child selection are required" }, { status: 400 });
  }

  let clubId: string;
  let schoolId: string;
  try {
    const payload = await verifyClubToken(decodeURIComponent(token));
    clubId = payload.clubId;
    schoolId = payload.schoolId;
  } catch {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 403 });
  }

  const admin = getAdmin();

  // Verify club is open and belongs to school
  const { data: club } = await (admin.from("clubs") as any)
    .select("id, name, fee_pence, fee_model, sessions_per_term, max_capacity, status, schools(name, trust_id, trusts(stripe_account_id))")
    .eq("id", clubId)
    .eq("school_id", schoolId)
    .single() as {
      data: {
        id: string; name: string; fee_pence: number; fee_model: string;
        sessions_per_term: number | null; max_capacity: number | null; status: string;
        schools: { name: string; trust_id: string; trusts: { stripe_account_id: string | null } | null } | null;
      } | null
    };

  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
  if (club.status === "closed") return NextResponse.json({ error: "Sign-ups are closed" }, { status: 410 });

  // Verify student belongs to this school
  const { data: student } = await admin
    .from("students")
    .select("id, first_name")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single() as { data: { id: string; first_name: string } | null };

  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  // Find or create guardian by email
  let { data: guardian } = await admin
    .from("guardians")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle() as { data: { id: string } | null };

  if (!guardian) {
    const { data: created } = await admin
      .from("guardians")
      .insert({ email: email.toLowerCase().trim() })
      .select("id")
      .single() as { data: { id: string } | null };
    guardian = created;
  }

  if (!guardian) return NextResponse.json({ error: "Failed to create account" }, { status: 500 });

  // Link guardian to student if not already linked
  await admin.from("guardian_student").upsert(
    { guardian_id: guardian.id, student_id: studentId, relationship: "parent" },
    { onConflict: "guardian_id,student_id", ignoreDuplicates: true }
  );

  // Check if already enrolled or waitlisted
  const { data: existing } = await (admin.from("club_enrollments") as any)
    .select("id, status")
    .eq("club_id", clubId)
    .eq("student_id", studentId)
    .maybeSingle() as { data: { id: string; status: string } | null };

  if (existing && existing.status !== "cancelled") {
    return NextResponse.json({
      error: existing.status === "enrolled"
        ? "This child is already enrolled in this club"
        : "This child is already on the waiting list"
    }, { status: 409 });
  }

  // Check capacity
  const { count: enrolledCount } = await (admin.from("club_enrollments") as any)
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("status", "enrolled") as { count: number | null };

  const isFull = club.max_capacity !== null && (enrolledCount ?? 0) >= club.max_capacity;

  // Waitlist
  if (isFull) {
    const { count: waitlistCount } = await (admin.from("club_enrollments") as any)
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "waitlisted") as { count: number | null };

    if (existing?.status === "cancelled") {
      await (admin.from("club_enrollments") as any)
        .update({ status: "waitlisted", waitlist_position: (waitlistCount ?? 0) + 1, guardian_id: guardian.id, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await (admin.from("club_enrollments") as any).insert({
        club_id: clubId,
        student_id: studentId,
        guardian_id: guardian.id,
        status: "waitlisted",
        payment_status: "unpaid",
        waitlist_position: (waitlistCount ?? 0) + 1,
      });
    }

    return NextResponse.json({ waitlisted: true });
  }

  // Not full — create enrollment (unpaid) then Stripe Checkout
  const totalFee = club.fee_model === "weekly"
    ? club.fee_pence * (club.sessions_per_term ?? 1)
    : club.fee_pence;

  let enrollmentId: string;
  if (existing?.status === "cancelled") {
    await (admin.from("club_enrollments") as any)
      .update({ status: "enrolled", waitlist_position: null, guardian_id: guardian.id, payment_status: "unpaid", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    enrollmentId = existing.id;
  } else {
    const { data: enrollment } = await (admin.from("club_enrollments") as any)
      .insert({ club_id: clubId, student_id: studentId, guardian_id: guardian.id, status: "enrolled", payment_status: "unpaid" })
      .select("id").single() as { data: { id: string } | null };
    if (!enrollment) return NextResponse.json({ error: "Failed to create enrollment" }, { status: 500 });
    enrollmentId = enrollment.id;
  }

  const stripeAccountId = (club.schools?.trusts as any)?.stripe_account_id as string | null;
  const encodedToken = encodeURIComponent(token);
  const successUrl = `${APP_URL}/clubs/signup/${encodedToken}?success=1`;
  const cancelUrl = `${APP_URL}/clubs/signup/${encodedToken}`;

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: "payment",
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "gbp",
        product_data: { name: `${club.name} — ${student.first_name}` },
        unit_amount: totalFee,
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: "club_enrollment",
      enrollment_id: enrollmentId,
      club_id: clubId,
    },
  };

  if (stripeAccountId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: 50,
      transfer_data: { destination: stripeAccountId },
    };
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    // Roll back enrollment
    await (admin.from("club_enrollments") as any).update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", enrollmentId);
    console.error("[clubs/signup] Stripe session failed:", err);
    return NextResponse.json({ error: "Payment session could not be created" }, { status: 502 });
  }

  // Store payment intent on enrollment
  if (session.payment_intent) {
    await (admin.from("club_enrollments") as any)
      .update({ stripe_payment_intent: session.payment_intent as string })
      .eq("id", enrollmentId);
  }

  return NextResponse.json({ url: session.url });
}
