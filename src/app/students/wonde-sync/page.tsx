import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { logout } from "@/app/login/actions";
import WondeSyncClient from "./WondeSyncClient";

export default async function WondeSyncPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();
  if (!school) redirect("/login");

  const db = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: schoolRow } = await (db as any)
    .from("schools")
    .select("wonde_token")
    .eq("id", school.id)
    .single();

  const connected = !!schoolRow?.wonde_token;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/students" className="text-sm text-gray-500 hover:text-gray-800">Students</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <a href="/students" className="text-sm text-gray-400 hover:text-gray-600">← Back to students</a>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">MIS Sync</h1>
          <p className="mt-1 text-sm text-gray-500">{school.name}</p>
        </div>

        <WondeSyncClient connected={connected} />
      </div>
    </main>
  );
}
