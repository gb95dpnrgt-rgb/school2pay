import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import { formatPence } from "@/lib/fees";
import type { Database } from "@/lib/supabase/types";
import { Suspense } from "react";
import FilterBar from "./FilterBar";
import ResendEmailButton from "./ResendEmailButton";
import RemindUnpaidButton from "./RemindUnpaidButton";
import AssignmentActions from "./AssignmentActions";
import RefundButton from "./RefundButton";
import CloseRequestButton from "./CloseRequestButton";
import SaveTemplateButton from "../SaveTemplateButton";

const PAGE_SIZE = 20;

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (db: any) => db.rpc.bind(db);

type SearchParams = { status?: string; q?: string; year?: string; page?: string };

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const statusFilter = sp.status ?? "";
  const nameFilter = (sp.q ?? "").trim();
  const yearFilter = sp.year ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  // Fetch request (RLS ensures it belongs to this admin's school)
  const { data: req } = await supabase
    .from("payment_requests")
    .select("id, title, description, amount_pence, due_date, year_groups, status, created_at")
    .eq("id", id)
    .single();

  if (!req) notFound();

  const admin = getAdmin();

  // ── Parallel fetches ────────────────────────────────────────────────────────

  const [summaryResult, assignmentsResult, yearGroupsResult, emailLogResult] = await Promise.all([
    // 1. SQL aggregate — no JS math, no loading all rows
    rpc(admin)("request_summary", { p_request_id: id }) as Promise<{
      data: Array<{
        total_students: number;
        paid_count: number;
        partial_count: number;
        unpaid_count: number;
        waived_count: number;
        total_expected_pence: number;
        total_collected_pence: number;
        pct_paid: number;
      }> | null;
    }>,

    // 2. Paginated, filtered assignment list
    (() => {
      let q = admin
        .from("assignments")
        .select(
          `id, amount_due_pence, amount_paid_pence, status,
           students!inner(id, first_name, year_group,
             guardian_student(guardians(id, email))
           )`,
          { count: "exact" }
        )
        .eq("payment_request_id", id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qa = q as any;
      if (statusFilter) qa.eq("status", statusFilter);
      if (yearFilter) qa.eq("students.year_group", yearFilter);
      if (nameFilter) qa.ilike("students.first_name", `%${nameFilter}%`);

      return (statusFilter ? q.eq("status", statusFilter as "unpaid" | "partial" | "paid" | "waived") : q)
        .order("year_group" as any, { referencedTable: "students", ascending: true })
        .order("first_name" as any, { referencedTable: "students", ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
    })() as unknown as Promise<{
      data: Array<{
        id: string;
        amount_due_pence: number;
        amount_paid_pence: number;
        status: string;
        students: {
          id: string;
          first_name: string;
          year_group: string;
          guardian_student: Array<{
            guardians: { id: string; email: string } | null;
          }>;
        };
      }> | null;
      count: number | null;
    }>,

    // 3. Distinct year groups for filter dropdown
    admin
      .from("assignments")
      .select("students!inner(year_group)")
      .eq("payment_request_id", id) as unknown as Promise<{
        data: Array<{ students: { year_group: string } }> | null;
      }>,

    // 4. Email log: last sent + bounce status per guardian
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from("email_log") as any)
      .select("guardian_id, sent_at, bounced_at, type")
      .eq("payment_request_id", id)
      .order("sent_at", { ascending: false }) as Promise<{
        data: Array<{
          guardian_id: string;
          sent_at: string;
          bounced_at: string | null;
          type: string;
        }> | null;
      }>,

  ]);

  const summary = summaryResult.data?.[0];
  const assignments = assignmentsResult.data ?? [];
  const totalRows = assignmentsResult.count ?? 0;

  // Audit log — fetch after assignments so we have their IDs
  const assignmentIds = assignments.map((a) => a.id);
  type AuditEntry = {
    assignment_id: string; action: string;
    amount_pence: number | null; note: string | null; created_at: string;
  };
  let auditByAssignment = new Map<string, AuditEntry[]>();
  if (assignmentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: auditRows } = await (admin.from("assignment_audit_log") as any)
      .select("assignment_id, action, amount_pence, note, created_at")
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: true }) as { data: AuditEntry[] | null };
    for (const row of auditRows ?? []) {
      if (!auditByAssignment.has(row.assignment_id)) auditByAssignment.set(row.assignment_id, []);
      auditByAssignment.get(row.assignment_id)!.push(row);
    }
  }
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  // ── Consent form (optional) ──────────────────────────────────────────────
  const { data: consentFormRow } = await (admin.from("consent_forms") as any)
    .select("id, type, requires_consent_before_payment")
    .eq("payment_request_id", id)
    .maybeSingle() as { data: { id: string; type: string; requires_consent_before_payment: boolean } | null };

  // Map assignmentId → consent status
  const consentByAssignment = new Map<string, "consented" | "withdrawn" | null>();
  if (consentFormRow && assignmentIds.length > 0) {
    const { data: responses } = await (admin.from("consent_responses") as any)
      .select("assignment_id, withdrawn_at, signed_at")
      .eq("consent_form_id", consentFormRow.id)
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false }) as {
        data: Array<{ assignment_id: string; withdrawn_at: string | null; signed_at: string }> | null;
      };
    // Take latest response per assignment
    for (const r of responses ?? []) {
      if (!consentByAssignment.has(r.assignment_id)) {
        consentByAssignment.set(r.assignment_id, r.withdrawn_at ? "withdrawn" : "consented");
      }
    }
  }

  // Distinct year groups sorted naturally
  const yearGroups = [
    ...new Set(
      (yearGroupsResult.data ?? []).map(
        (r) => (r.students as unknown as { year_group: string }).year_group
      )
    ),
  ].sort();

  const lastEmailByGuardian = new Map<string, string>();
  const bouncedGuardians = new Set<string>();
  for (const log of emailLogResult.data ?? []) {
    if (!lastEmailByGuardian.has(log.guardian_id)) {
      lastEmailByGuardian.set(log.guardian_id, log.sent_at);
    }
    if (log.bounced_at) bouncedGuardians.add(log.guardian_id);
  }

  const dueFormatted = new Date(req.due_date).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const pctPaid = Number(summary?.pct_paid ?? 0);
  const totalExpected = Number(summary?.total_expected_pence ?? 0);
  const totalCollected = Number(summary?.total_collected_pence ?? 0);
  const totalStudents = Number(summary?.total_students ?? 0);
  const paidCount = Number(summary?.paid_count ?? 0);
  const unpaidCount = Number(summary?.unpaid_count ?? 0);

  // Build URL helper for pagination links
  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (nameFilter) params.set("q", nameFilter);
    if (yearFilter) params.set("year", yearFilter);
    params.set("page", String(p));
    return `/requests/${id}?${params.toString()}`;
  };

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/students" className="text-sm text-gray-500 hover:text-gray-800">Students</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Back + title */}
        <div>
          <a href="/requests" className="text-sm text-gray-400 hover:text-gray-600">← Back to requests</a>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{req.title}</h1>
              <p className="mt-0.5 text-sm text-gray-500">{school?.name} · Due {dueFormatted}</p>
              {req.description && <p className="mt-1 text-sm text-gray-600">{req.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                req.status === "open" ? "bg-green-100 text-green-700" :
                req.status === "closed" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-600"
              }`}>
                {req.status}
              </span>
              <SaveTemplateButton
                title={req.title}
                description={req.description ?? null}
                amountPence={req.amount_pence}
              />
              <CloseRequestButton requestId={req.id} currentStatus={req.status} />
            </div>
          </div>
        </div>

        {/* ── Aggregate stats (all from SQL) ───────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Expected (gross)"
            value={formatPence(totalExpected)}
            sub={`${totalStudents} students`}
            subLabel=""
          />
          <StatCard
            label="Collected (gross)"
            value={formatPence(totalCollected)}
            sub={`${paidCount} / ${totalStudents} paid`}
            subLabel=""
          />
          <StatCard
            label="Outstanding (gross)"
            value={formatPence(totalExpected - totalCollected)}
            sub={`${unpaidCount} still unpaid`}
            subLabel=""
            highlight={unpaidCount > 0}
          />
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">% Paid</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{pctPaid}%</p>
            <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-400 transition-all"
                style={{ width: `${pctPaid}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Consent summary ─────────────────────────────────────────────── */}
        {consentFormRow && (() => {
          const consentedCount = [...consentByAssignment.values()].filter((v) => v === "consented").length;
          const withdrawnCount = [...consentByAssignment.values()].filter((v) => v === "withdrawn").length;
          const pendingCount = totalStudents - consentedCount - withdrawnCount;
          return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Consent form</p>
                <p className="text-xs text-amber-700 mt-0.5 capitalize">{consentFormRow.type.replace("_", " ")}{consentFormRow.requires_consent_before_payment && " · required before payment"}</p>
              </div>
              <div className="flex gap-6">
                <div><p className="text-lg font-bold text-green-700">{consentedCount}</p><p className="text-xs text-gray-500">Consented</p></div>
                <div><p className="text-lg font-bold text-amber-700">{pendingCount}</p><p className="text-xs text-gray-500">Pending</p></div>
                {withdrawnCount > 0 && <div><p className="text-lg font-bold text-red-600">{withdrawnCount}</p><p className="text-xs text-gray-500">Withdrawn</p></div>}
              </div>
            </div>
          );
        })()}

        {/* ── Filters + chase action ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Suspense>
            <FilterBar yearGroups={yearGroups} totalUnpaid={unpaidCount} />
          </Suspense>
          <RemindUnpaidButton requestId={req.id} unpaidCount={unpaidCount} />
        </div>

        {/* ── Student / assignment table ────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Students
              {totalRows > 0 && (
                <span className="ml-2 font-normal text-gray-400 normal-case">
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, totalRows)} of {totalRows}
                </span>
              )}
            </h2>
            <a
              href={`/api/export/request/${id}?${new URLSearchParams(
                Object.fromEntries(
                  Object.entries({ status: statusFilter, q: nameFilter, year: yearFilter }).filter(([, v]) => v)
                )
              ).toString()}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              ↓ Export CSV
            </a>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {assignments.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-gray-400">
                No students match the current filters.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Year</th>
                    <th className="px-4 py-3 text-right">Due (gross)</th>
                    <th className="px-4 py-3 text-right">Paid (gross)</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    {consentFormRow && <th className="px-4 py-3 text-left">Consent</th>}
                    <th className="px-4 py-3 text-left">Guardian</th>
                    <th className="px-4 py-3 text-left">Last email</th>
                    <th className="px-4 py-3 text-left">Actions / audit</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((asgn) => {
                    const student = asgn.students as unknown as {
                      id: string; first_name: string; year_group: string;
                      guardian_student: Array<{ guardians: { id: string; email: string } | null }>;
                    };
                    const guardians = student.guardian_student
                      .map((gs) => gs.guardians)
                      .filter(Boolean) as Array<{ id: string; email: string }>;
                    const firstGuardian = guardians[0];
                    const lastSent = firstGuardian
                      ? lastEmailByGuardian.get(firstGuardian.id)
                      : undefined;
                    const auditEntries = auditByAssignment.get(asgn.id) ?? [];
                    const canAct = asgn.status !== "paid" && asgn.status !== "waived";
                    const canRefund = asgn.status === "paid";

                    return (
                      <tr key={asgn.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {student.first_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{student.year_group}</td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                          {formatPence(asgn.amount_due_pence)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                          {asgn.amount_paid_pence > 0
                            ? formatPence(asgn.amount_paid_pence)
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={asgn.status} />
                        </td>
                        {consentFormRow && (
                          <td className="px-4 py-3 text-xs">
                            {(() => {
                              const cs = consentByAssignment.get(asgn.id) ?? null;
                              if (cs === "consented") return <span className="inline-flex items-center gap-1 text-green-700 font-medium">✓ Consented</span>;
                              if (cs === "withdrawn") return <span className="text-red-500">Withdrawn</span>;
                              return <span className="text-gray-300">Pending</span>;
                            })()}
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {firstGuardian ? (
                            <div className="flex flex-col gap-0.5">
                              <span title={guardians.map((g) => g.email).join(", ")}>
                                {firstGuardian.email}
                                {guardians.length > 1 && (
                                  <span className="ml-1 text-gray-400">+{guardians.length - 1}</span>
                                )}
                              </span>
                              {bouncedGuardians.has(firstGuardian.id) && (
                                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                  <span>⚠</span> Email bounced — contact directly
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">No guardian</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {lastSent
                            ? new Date(lastSent).toLocaleDateString("en-GB", {
                                day: "numeric", month: "short",
                              })
                            : <span className="text-gray-300">Not sent</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-col gap-1.5">
                            {/* Resend email */}
                            {firstGuardian && canAct && (
                              <ResendEmailButton
                                guardianId={firstGuardian.id}
                                paymentRequestId={req.id}
                              />
                            )}
                            {/* Waive / Offline payment */}
                            {canAct && (
                              <AssignmentActions
                                assignmentId={asgn.id}
                                requestId={req.id}
                                studentName={student.first_name}
                                amountDuePence={asgn.amount_due_pence}
                              />
                            )}
                            {/* Refund (Stripe payments only) */}
                            {canRefund && (
                              <RefundButton
                                assignmentId={asgn.id}
                                requestId={req.id}
                                studentName={student.first_name}
                                amountPaidPence={asgn.amount_paid_pence}
                              />
                            )}
                            {/* Audit trail */}
                            {auditEntries.length > 0 && (
                              <div className="mt-1 space-y-0.5 border-l-2 border-gray-200 pl-2">
                                {auditEntries.map((entry, i) => (
                                  <div key={i} className="text-gray-400 leading-snug">
                                    <span className="font-medium text-gray-600">
                                      {entry.action === "waive" ? "Waived" :
                                       entry.action === "offline_payment"
                                         ? `Cash/cheque ${formatPence(entry.amount_pence ?? 0)}`
                                         : "Note"}
                                    </span>
                                    {" · "}
                                    {new Date(entry.created_at).toLocaleDateString("en-GB", {
                                      day: "numeric", month: "short", year: "2-digit",
                                    })}
                                    {entry.note && (
                                      <span className="block text-gray-400 italic truncate max-w-[200px]" title={entry.note}>
                                        {entry.note}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={buildUrl(page - 1)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                  >
                    ← Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={buildUrl(page + 1)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-600 hover:bg-gray-50"
                  >
                    Next →
                  </a>
                )}
              </div>
            </div>
          )}
        </section>

        <p className="text-xs text-gray-400 text-center">
          All amounts are <strong>gross</strong> (what parents pay).{" "}
          <a href="/fees" className="underline hover:text-gray-600">See how fees work →</a>
        </p>
      </div>
    </main>
  );
}

function StatCard({
  label, value, sub, highlight = false,
}: {
  label: string; value: string; sub: string; subLabel: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid" ? "bg-green-100 text-green-700" :
    status === "waived" ? "bg-gray-100 text-gray-500" :
    status === "partial" ? "bg-blue-100 text-blue-700" :
    "bg-amber-100 text-amber-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
