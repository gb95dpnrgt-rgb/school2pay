import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { verifyMagicToken } from "@/lib/magic-link";
import type { Database } from "@/lib/supabase/types";
import PayWithConsent from "./PayWithConsent";
import type { ConsentFormData } from "./ConsentForm";

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type Assignment = {
  id: string;
  amount_due_pence: number;
  amount_paid_pence: number;
  status: string;
  students: { first_name: string; year_group: string };
};

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let payload: { guardianId: string; paymentRequestId: string };
  try {
    payload = await verifyMagicToken(decodeURIComponent(token));
  } catch {
    return <ExpiredPage />;
  }

  const admin = getAdmin();

  const [guardianResult, reqResult] = await Promise.all([
    admin.from("guardians").select("id, email").eq("id", payload.guardianId).single(),
    (admin.from("payment_requests") as any)
      .select("id, title, description, due_date, schools(name), allow_partial")
      .eq("id", payload.paymentRequestId)
      .single(),
  ]);

  const guardian = guardianResult.data;
  if (!guardian) notFound();

  const req = reqResult.data as {
    id: string; title: string; description: string | null; due_date: string;
    schools: { name: string } | null; allow_partial: boolean;
  } | null;
  if (!req) notFound();

  // Fetch guardian's assignments
  const { data: assignments } = await admin
    .from("assignments")
    .select(`
      id, amount_due_pence, amount_paid_pence, status,
      students!inner(first_name, year_group,
        guardian_student!inner(guardian_id)
      )
    `)
    .eq("payment_request_id", payload.paymentRequestId)
    .eq("students.guardian_student.guardian_id", guardian.id) as {
      data: Array<{
        id: string; amount_due_pence: number; amount_paid_pence: number; status: string;
        students: {
          first_name: string; year_group: string;
          guardian_student: Array<{ guardian_id: string }>;
        };
      }> | null;
    };

  const myAssignments: Assignment[] = (assignments ?? []).map((a) => ({
    id: a.id,
    amount_due_pence: a.amount_due_pence,
    amount_paid_pence: a.amount_paid_pence,
    status: a.status,
    students: { first_name: a.students.first_name, year_group: a.students.year_group },
  }));

  // Fetch consent form for this payment request (if any)
  const { data: consentFormRow } = await (admin.from("consent_forms") as any)
    .select("id, type, requires_consent_before_payment, consent_fields(id, key, label, field_type, required, sort_order)")
    .eq("payment_request_id", payload.paymentRequestId)
    .maybeSingle();

  let consentForms: ConsentFormData[] = [];
  let requiresConsentBeforePayment = false;

  if (consentFormRow) {
    requiresConsentBeforePayment = consentFormRow.requires_consent_before_payment;
    const fields = (consentFormRow.consent_fields ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    );

    // Build one ConsentFormData per assignment (one per child)
    consentForms = await Promise.all(
      myAssignments.map(async (a) => {
        // Fetch latest non-withdrawn response for this assignment
        const { data: latest } = await (admin.from("consent_responses") as any)
          .select("id, responses, guardian_name_signed, signed_at, withdrawn_at")
          .eq("consent_form_id", consentFormRow.id)
          .eq("assignment_id", a.id)
          .eq("guardian_id", guardian.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          consentFormId: consentFormRow.id,
          assignmentId: a.id,
          fields,
          consentFormType: consentFormRow.type,
          studentName: `${a.students.first_name} (${a.students.year_group})`,
          existingResponse: latest ?? null,
        } satisfies ConsentFormData;
      })
    );
  }

  const dueFormatted = new Date(req.due_date).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const schoolName = (req.schools as unknown as { name: string } | null)?.name ?? "";

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-gray-500">{schoolName}</p>
          <h1 className="text-2xl font-bold text-gray-900">{req.title}</h1>
          {req.description && <p className="text-sm text-gray-500">{req.description}</p>}
          <p className="text-xs text-gray-400">Due {dueFormatted}</p>
        </div>

        {myAssignments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            No outstanding payments found for your children.
          </div>
        ) : (
          <PayWithConsent
            assignments={myAssignments}
            guardianId={guardian.id}
            paymentRequestId={req.id}
            token={token}
            allowPartial={req.allow_partial ?? false}
            consentForms={consentForms}
            requiresConsentBeforePayment={requiresConsentBeforePayment}
          />
        )}

        <p className="text-center text-xs text-gray-400">
          This link is personal to you. Do not share it.
        </p>
      </div>
    </main>
  );
}

function ExpiredPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-xl border border-gray-200 bg-white p-8 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold text-gray-900">This link has expired</h1>
        <p className="text-sm text-gray-500">
          Payment links expire after 7 days for security. Please contact your school to request a new link.
        </p>
      </div>
    </main>
  );
}
