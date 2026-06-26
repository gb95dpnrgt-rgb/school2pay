import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import { stripe } from "@/lib/stripe";
import { formatPence } from "@/lib/fees";
import InviteAdminForm from "./InviteAdminForm";
import type { Database } from "@/lib/supabase/types";

type StripeStatus = "not_started" | "in_progress" | "complete";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface Analytics {
  totalCollectedPence: number;
  totalOutstandingPence: number;
  totalExpectedPence: number;
  collectionRatePct: number;
  openRequestCount: number;
  overdueRequestCount: number;
  thisMonthPence: number;
  lastMonthPence: number;
  urgentRequests: Array<{ id: string; title: string; dueDate: string; outstandingPence: number; unpaidCount: number }>;
}

async function getAnalytics(schoolId: string): Promise<Analytics> {
  const admin = getAdmin();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // All assignments with their request + status
  const { data: assignments } = await admin
    .from("assignments")
    .select("amount_due_pence, amount_paid_pence, status, payment_requests!inner(id, title, due_date, status, school_id)")
    .eq("payment_requests.school_id", schoolId) as {
      data: Array<{
        amount_due_pence: number;
        amount_paid_pence: number;
        status: string;
        payment_requests: { id: string; title: string; due_date: string; status: string };
      }> | null;
    };

  const all = assignments ?? [];

  // Only look at open requests
  const open = all.filter((a) => a.payment_requests.status === "open");

  const totalExpectedPence = open.reduce((s, a) => s + a.amount_due_pence, 0);
  const totalCollectedPence = open.reduce((s, a) => s + a.amount_paid_pence, 0);
  const totalOutstandingPence = totalExpectedPence - totalCollectedPence;
  const collectionRatePct = totalExpectedPence > 0
    ? Math.round((totalCollectedPence / totalExpectedPence) * 100)
    : 0;

  // Open/overdue request counts
  const requestIds = [...new Set(open.map((a) => a.payment_requests.id))];
  const openRequestCount = requestIds.length;
  const overdueRequestCount = [...new Set(
    open
      .filter((a) => a.payment_requests.due_date < todayStr && (a.status === "unpaid" || a.status === "partial"))
      .map((a) => a.payment_requests.id)
  )].length;

  // This month / last month collected — from transactions
  const { data: thisTxns } = await admin
    .from("transactions")
    .select("amount_pence, created_at")
    .eq("status", "succeeded")
    .gte("created_at", firstOfMonth)
    .lt("created_at", firstOfNextMonth);

  const { data: lastTxns } = await admin
    .from("transactions")
    .select("amount_pence, created_at")
    .eq("status", "succeeded")
    .gte("created_at", firstOfLastMonth)
    .lt("created_at", firstOfMonth);

  const thisMonthPence = (thisTxns ?? []).reduce((s, t) => s + t.amount_pence, 0);
  const lastMonthPence = (lastTxns ?? []).reduce((s, t) => s + t.amount_pence, 0);

  // Urgent: open requests due within 7 days with outstanding balance
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const in7Str = in7Days.toISOString().slice(0, 10);

  const urgentMap = new Map<string, { id: string; title: string; dueDate: string; outstandingPence: number; unpaidCount: number }>();
  for (const a of open) {
    const req = a.payment_requests;
    if (req.due_date > in7Str) continue;
    if (a.status !== "unpaid" && a.status !== "partial") continue;
    if (!urgentMap.has(req.id)) {
      urgentMap.set(req.id, { id: req.id, title: req.title, dueDate: req.due_date, outstandingPence: 0, unpaidCount: 0 });
    }
    const entry = urgentMap.get(req.id)!;
    entry.outstandingPence += a.amount_due_pence - a.amount_paid_pence;
    entry.unpaidCount += 1;
  }

  const urgentRequests = [...urgentMap.values()]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  return {
    totalCollectedPence,
    totalOutstandingPence,
    totalExpectedPence,
    collectionRatePct,
    openRequestCount,
    overdueRequestCount,
    thisMonthPence,
    lastMonthPence,
    urgentRequests,
  };
}

async function getStripeStatus(stripeAccountId: string | null | undefined): Promise<StripeStatus> {
  if (!stripeAccountId) return "not_started";
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    return account.charges_enabled && account.details_submitted ? "complete" : "in_progress";
  } catch {
    return "in_progress";
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, trust_id, trusts!schools_trust_id_fkey(id, legal_name, stripe_account_id)")
    .single();

  const trust = school?.trusts && !Array.isArray(school.trusts) ? school.trusts : null;
  const [stripeStatus, analytics] = await Promise.all([
    getStripeStatus(trust?.stripe_account_id),
    school?.id ? getAnalytics(school.id) : null,
  ]);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900">School2Pay</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            Sign out
          </button>
        </form>
      </nav>

      <div id="main-content" className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* School header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {school?.name ?? "Your school"}
          </h1>
          {trust && (
            <p className="mt-1 text-sm text-gray-500">{trust.legal_name}</p>
          )}
        </div>

        {/* Admin info */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Signed in as <span className="font-medium text-gray-800">{user.email}</span>
          </p>
        </div>

        {/* Stripe status card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Payments setup</h2>
            <StripeStatusBadge status={stripeStatus} />
          </div>

          {stripeStatus === "complete" && (
            <p className="text-sm text-gray-500">
              Your trust is verified and can accept card payments from parents.
            </p>
          )}

          {stripeStatus === "in_progress" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Stripe onboarding is incomplete. Some information may still be required.
              </p>
              <a
                href="/onboarding"
                className="inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Resume Stripe setup →
              </a>
            </div>
          )}

          {stripeStatus === "not_started" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">
                Connect a bank account to start accepting payments from parents.
              </p>
              <a
                href="/onboarding"
                className="inline-block text-sm font-medium text-blue-600 hover:underline"
              >
                Start Stripe setup →
              </a>
            </div>
          )}
        </div>

        {/* Analytics */}
        {analytics && stripeStatus === "complete" && (
          <section aria-label="Payment analytics" className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Collected (open requests)" value={formatPence(analytics.totalCollectedPence)} sub="gross" />
              <KpiCard label="Outstanding" value={formatPence(analytics.totalOutstandingPence)} sub="gross" highlight={analytics.totalOutstandingPence > 0} />
              <KpiCard label="Collection rate" value={`${analytics.collectionRatePct}%`} sub={`${analytics.openRequestCount} open request${analytics.openRequestCount !== 1 ? "s" : ""}`} />
              <KpiCard
                label="This month"
                value={formatPence(analytics.thisMonthPence)}
                sub={analytics.lastMonthPence > 0
                  ? `${analytics.thisMonthPence >= analytics.lastMonthPence ? "▲" : "▼"} ${formatPence(Math.abs(analytics.thisMonthPence - analytics.lastMonthPence))} vs last month`
                  : "gross collected"}
              />
            </div>

            {/* Collection progress bar */}
            {analytics.totalExpectedPence > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Overall collection progress</span>
                  <span className="font-medium text-gray-700">{analytics.collectionRatePct}%</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={analytics.collectionRatePct} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="h-full rounded-full bg-green-400 transition-all duration-500"
                    style={{ width: `${analytics.collectionRatePct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{formatPence(analytics.totalCollectedPence)} collected</span>
                  <span>{formatPence(analytics.totalExpectedPence)} expected</span>
                </div>
              </div>
            )}

            {/* Urgent attention */}
            {analytics.urgentRequests.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-amber-800">
                  Needs attention — {analytics.overdueRequestCount > 0 ? `${analytics.overdueRequestCount} overdue` : "due soon"}
                </h2>
                <ul className="space-y-2">
                  {analytics.urgentRequests.map((req) => {
                    const isOverdue = req.dueDate < new Date().toISOString().slice(0, 10);
                    return (
                      <li key={req.id}>
                        <a href={`/requests/${req.id}`} className="flex items-center justify-between group">
                          <div>
                            <span className="text-sm font-medium text-amber-900 group-hover:underline">{req.title}</span>
                            <span className={`ml-2 text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-amber-600"}`}>
                              {isOverdue ? "Overdue" : "Due"} {new Date(req.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          <span className="text-sm font-mono text-amber-800">
                            {formatPence(req.outstandingPence)} outstanding · {req.unpaidCount} pupils
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Payment requests section */}
        {stripeStatus === "complete" ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Payment requests</h2>
              <p className="text-sm text-gray-500 mt-1">Create and manage payment campaigns for parents.</p>
            </div>
            <a
              href="/requests"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              View requests
            </a>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
            <h2 className="text-sm font-semibold text-amber-800">Payment requests are locked</h2>
            <p className="text-sm text-amber-700">
              You cannot create payment requests until your Stripe setup is complete and your trust
              account is verified to accept card payments.
            </p>
            <a
              href="/onboarding"
              className="inline-block mt-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              {stripeStatus === "not_started" ? "Set up payments" : "Resume payments setup"}
            </a>
          </div>
        )}

        {/* Invite admin */}
        <InviteAdminForm />
      </div>

      <footer className="max-w-4xl mx-auto px-6 py-6 mt-4 border-t border-gray-200 flex justify-between text-xs text-gray-400">
        <span>School2Pay</span>
        <a href="/fees" className="underline hover:text-gray-600">Fee schedule</a>
      </footer>
    </main>
  );
}

function KpiCard({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StripeStatusBadge({ status }: { status: StripeStatus }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Complete
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        Action needed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Not started
    </span>
  );
}
