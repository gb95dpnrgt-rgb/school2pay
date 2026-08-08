import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addSchool } from "./actions";
import AddSchoolForm from "./AddSchoolForm";

export default async function NewSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Fetch existing trust so we can offer "add to existing trust" option
  const { data: existingSchool } = await supabase
    .from("schools")
    .select("trust_id, trusts!schools_trust_id_fkey(legal_name)")
    .limit(1)
    .maybeSingle();

  const existingTrust = existingSchool?.trusts && !Array.isArray(existingSchool.trusts)
    ? existingSchool.trusts
    : null;

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6">
        <div>
          <a href="/dashboard" className="text-sm text-blue-600 hover:underline">← Back to dashboard</a>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Add a new school</h1>
          <p className="text-sm text-gray-500 mt-1">Create another school linked to your account.</p>
        </div>

        {params.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        <AddSchoolForm action={addSchool} existingTrustName={existingTrust?.legal_name ?? null} />
      </div>
    </main>
  );
}
