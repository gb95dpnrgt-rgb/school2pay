import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { createPaymentRequest } from "./actions";
import TargetAndFees from "./TargetAndFees";
import TemplateLoader from "./TemplateLoader";
import ConsentToggle from "./ConsentToggle";

export default async function NewRequestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

  const { data: yearGroupRows } = await supabase
    .from("students")
    .select("year_group")
    .order("year_group");

  const yearGroups = [...new Set((yearGroupRows ?? []).map((r) => r.year_group))];

  const { count: totalStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true });

  const yearGroupCounts: Record<string, number> = {};
  for (const yg of yearGroups) {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("year_group", yg);
    yearGroupCounts[yg] = count ?? 0;
  }

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

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <a href="/requests" className="text-sm text-gray-400 hover:text-gray-600">← Back to requests</a>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">New payment request</h1>
          <p className="mt-1 text-sm text-gray-500">{school?.name}</p>
        </div>

        <TemplateLoader />

        <form action={createPaymentRequest} className="space-y-6 bg-white rounded-xl border border-gray-200 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              name="title"
              type="text"
              required
              placeholder="e.g. Year 5 residential trip"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Shown to parents alongside the payment link"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <TargetAndFees
            totalStudents={totalStudents ?? 0}
            yearGroups={yearGroups}
            yearGroupCounts={yearGroupCounts}
          />

          <div className="flex items-start gap-3">
            <input
              id="allow_partial"
              name="allow_partial"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <label htmlFor="allow_partial" className="block text-sm font-medium text-gray-700 cursor-pointer">
                Allow partial payments (instalments)
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                Parents can pay any amount ≥ £1 toward each child&apos;s balance and pay the rest later.
              </p>
            </div>
          </div>

          <ConsentToggle />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
            <input
              name="due_date"
              type="date"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create &amp; fan out
            </button>
            <a
              href="/requests"
              className="rounded-lg border border-gray-300 px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-400 text-center">
          No surcharging — the price parents see is the price they pay.{" "}
          <a href="/fees" className="underline hover:text-gray-600">How fees work →</a>
        </p>
      </div>
    </main>
  );
}
