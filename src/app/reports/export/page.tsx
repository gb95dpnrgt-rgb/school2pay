import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import ExportForm from "./ExportForm";

export default async function ExportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/students" className="text-sm text-gray-500 hover:text-gray-800">Students</a>
          <a href="/reports/export" className="text-sm font-medium text-blue-600">Reports</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Finance export</h1>
          <p className="mt-1 text-sm text-gray-500">
            Download transaction data mapped to your finance system&apos;s column format.
          </p>
        </div>
        <ExportForm />
      </div>
    </main>
  );
}
