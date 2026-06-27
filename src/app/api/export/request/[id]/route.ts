import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { buildCsv, csvResponse } from "@/lib/csv";
import { formatPence } from "@/lib/fees";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // RLS — verify request belongs to admin's school
  const { data: payReq } = await supabase
    .from("payment_requests")
    .select("id, title")
    .eq("id", id)
    .single();
  if (!payReq) return new Response("Not found", { status: 404 });

  // Read filters from query params (mirror page.tsx)
  const sp = req.nextUrl.searchParams;
  const statusFilter = sp.get("status") ?? "";
  const nameFilter = sp.get("q") ?? "";
  const yearFilter = sp.get("year") ?? "";

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch ALL matching assignments (no pagination for export)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (admin as any)
    .from("assignments")
    .select(`
      id, amount_due_pence, amount_paid_pence, status,
      students!inner(first_name, year_group,
        guardian_student(guardians(email))
      )
    `)
    .eq("payment_request_id", id);

  if (statusFilter) q = q.eq("status", statusFilter);
  if (yearFilter) q = q.eq("students.year_group", yearFilter);
  if (nameFilter) q = q.ilike("students.first_name", `%${nameFilter}%`);

  q = q.order("year_group", { referencedTable: "students", ascending: true })
       .order("first_name", { referencedTable: "students", ascending: true });

  const { data: rows } = await q as {
    data: Array<{
      id: string;
      amount_due_pence: number;
      amount_paid_pence: number;
      status: string;
      students: {
        first_name: string;
        year_group: string;
        guardian_student: Array<{ guardians: { email: string } | null }>;
      };
    }> | null;
  };

  // Fetch consent form + responses for this request
  const { data: consentFormRow } = await (admin.from("consent_forms") as any)
    .select("id, consent_fields(key, label, sort_order)")
    .eq("payment_request_id", id)
    .maybeSingle() as {
      data: { id: string; consent_fields: Array<{ key: string; label: string; sort_order: number }> } | null
    };

  // Map assignmentId → latest active consent response
  const consentResponseMap = new Map<string, { responses: Record<string, unknown>; guardian_name_signed: string; signed_at: string; withdrawn_at: string | null }>();
  if (consentFormRow && assignmentIds.length > 0) {
    const { data: consentRows } = await (admin.from("consent_responses") as any)
      .select("assignment_id, responses, guardian_name_signed, signed_at, withdrawn_at")
      .eq("consent_form_id", consentFormRow.id)
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false }) as {
        data: Array<{ assignment_id: string; responses: Record<string, unknown>; guardian_name_signed: string; signed_at: string; withdrawn_at: string | null }> | null
      };
    for (const r of consentRows ?? []) {
      if (!consentResponseMap.has(r.assignment_id)) {
        consentResponseMap.set(r.assignment_id, r);
      }
    }
  }

  const consentFields = (consentFormRow?.consent_fields ?? [])
    .sort((a, b) => a.sort_order - b.sort_order);

  // Fetch audit log for these assignment IDs
  const assignmentIds = (rows ?? []).map((r) => r.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: auditRows } = assignmentIds.length > 0
    ? await (admin.from("assignment_audit_log") as any)
        .select("assignment_id, action, amount_pence, note, created_at")
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  // Build audit summary per assignment
  const auditSummary = new Map<string, string>();
  for (const a of (auditRows ?? [])) {
    const prev = auditSummary.get(a.assignment_id) ?? "";
    const entry =
      a.action === "waive" ? `Waived${a.note ? ` (${a.note})` : ""}` :
      a.action === "offline_payment" ? `Cash/cheque ${formatPence(a.amount_pence ?? 0)}${a.note ? ` — ${a.note}` : ""}` :
      a.note ?? a.action;
    auditSummary.set(a.assignment_id, prev ? `${prev}; ${entry}` : entry);
  }

  const consentHeaders = consentFields.length > 0
    ? ["Consent status", "Signed by", "Signed at", ...consentFields.map((f) => f.label)]
    : [];

  const headers = [
    "Student first name",
    "Year group",
    "Guardian email(s)",
    "Amount due (£)",
    "Amount paid (£)",
    "Status",
    "Audit notes",
    ...consentHeaders,
  ];

  const csvRows = (rows ?? []).map((r) => {
    const guardianEmails = r.students.guardian_student
      .map((gs) => gs.guardians?.email)
      .filter(Boolean)
      .join("; ");

    const base = [
      r.students.first_name,
      r.students.year_group,
      guardianEmails,
      (r.amount_due_pence / 100).toFixed(2),
      (r.amount_paid_pence / 100).toFixed(2),
      r.status,
      auditSummary.get(r.id) ?? "",
    ];

    if (consentFields.length === 0) return base;

    const cr = consentResponseMap.get(r.id);
    if (!cr) {
      return [...base, "Pending", "", "", ...consentFields.map(() => "")];
    }
    const consentStatus = cr.withdrawn_at ? "Withdrawn" : "Consented";
    const signedAt = cr.signed_at
      ? new Date(cr.signed_at).toLocaleDateString("en-GB")
      : "";
    const fieldValues = consentFields.map((f) => {
      const val = cr.responses[f.key];
      if (Array.isArray(val)) return val.join(", ");
      return val != null ? String(val) : "";
    });
    return [...base, consentStatus, cr.guardian_name_signed, signedAt, ...fieldValues];
  });

  const safeName = payReq.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const csv = buildCsv(headers, csvRows);
  return csvResponse(csv, `${safeName}_students.csv`);
}
