import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { verifyHistoryToken } from "@/lib/magic-link";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function GuardianHistoryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let guardianId: string;
  try {
    const payload = await verifyHistoryToken(token);
    guardianId = payload.guardianId;
  } catch {
    return <ExpiredPage />;
  }

  const admin = getAdmin();

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, email")
    .eq("id", guardianId)
    .single();

  if (!guardian) notFound();

  // Fetch all transactions for this guardian
  const { data: txns } = await admin
    .from("transactions")
    .select(`
      id, amount_pence, status, created_at, stripe_payment_intent,
      transaction_lines(
        amount_pence,
        assignments!inner(
          students!inner(first_name, year_group),
          payment_requests!inner(title, schools!inner(name))
        )
      )
    `)
    .eq("guardian_id", guardianId)
    .in("status", ["succeeded", "refunded"])
    .order("created_at", { ascending: false }) as {
      data: Array<{
        id: string;
        amount_pence: number;
        status: string;
        created_at: string;
        stripe_payment_intent: string | null;
        transaction_lines: Array<{
          amount_pence: number;
          assignments: {
            students: { first_name: string; year_group: string };
            payment_requests: { title: string; schools: { name: string } };
          };
        }>;
      }> | null;
    };

  const totalPaid = (txns ?? [])
    .filter((t) => t.status === "succeeded")
    .reduce((s, t) => s + t.amount_pence, 0);

  const totalRefunded = (txns ?? [])
    .filter((t) => t.status === "refunded")
    .reduce((s, t) => s + t.amount_pence, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Your payment history</h1>
          <p className="text-sm text-gray-500">{guardian.email}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total paid</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              £{(totalPaid / 100).toFixed(2)}
            </p>
          </div>
          {totalRefunded > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Refunded</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                £{(totalRefunded / 100).toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Transaction list */}
        {!txns || txns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            No payments found.
          </div>
        ) : (
          <div className="space-y-3">
            {txns.map((txn) => {
              const date = new Date(txn.created_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              });
              const isRefund = txn.status === "refunded";
              const schoolName = txn.transaction_lines[0]?.assignments?.payment_requests?.schools?.name ?? "";

              return (
                <div
                  key={txn.id}
                  className={`rounded-xl border bg-white p-4 space-y-3 ${isRefund ? "border-amber-200 bg-amber-50/30" : "border-gray-200"}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-400">{date}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{schoolName}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-bold font-mono ${isRefund ? "text-amber-600" : "text-gray-900"}`}>
                        {isRefund ? "−" : ""}£{(txn.amount_pence / 100).toFixed(2)}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        isRefund ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      }`}>
                        {isRefund ? "Refunded" : "Paid"}
                      </span>
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="space-y-1.5 border-t border-gray-100 pt-2">
                    {txn.transaction_lines.map((line, i) => {
                      const student = line.assignments?.students;
                      const request = line.assignments?.payment_requests;
                      return (
                        <div key={i} className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium text-gray-800">{student?.first_name}</span>
                            <span className="text-gray-400 text-xs ml-1.5">Yr {student?.year_group}</span>
                            <p className="text-xs text-gray-400 mt-0.5">{request?.title}</p>
                          </div>
                          <span className="font-mono text-sm text-gray-700">
                            £{(line.amount_pence / 100).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {txn.stripe_payment_intent && (
                    <p className="text-xs text-gray-300 font-mono truncate">
                      Ref: {txn.stripe_payment_intent}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Receipts are emailed to you automatically after each payment.
          This link is personal — do not share it.
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
          History links expire after 30 days. Please contact your school to request a new link.
        </p>
      </div>
    </main>
  );
}
