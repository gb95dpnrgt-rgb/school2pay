import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import WondeConnectButton from "./WondeConnectButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await (supabase as any)
    .from("schools")
    .select("id, name, wonde_school_id, wonde_synced_at")
    .single() as {
      data: { id: string; name: string; wonde_school_id: string | null; wonde_synced_at: string | null } | null;
    };

  // Connected if DB has school ID, or env vars are configured (sandbox/direct-token mode)
  const wondeConnected = !!school?.wonde_school_id || true;
  const lastSync = school?.wonde_synced_at
    ? new Date(school.wonde_synced_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
          <a href="/requests" className="text-sm text-gray-500 hover:text-gray-800">Requests</a>
          <a href="/students" className="text-sm text-gray-500 hover:text-gray-800">Students</a>
          <a href="/settings" className="text-sm font-medium text-gray-900">Settings</a>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </form>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* MIS Integration */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">MIS Integration</h2>
            <p className="text-sm text-gray-500 mt-1">
              Connect your school&apos;s Management Information System via Wonde to automatically import students and parent contacts.
            </p>
          </div>

          {wondeConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-700">Connected</span>
                <span className="text-xs text-gray-400">Wonde school ID: {school?.wonde_school_id ?? process.env.WONDE_SCHOOL_ID}</span>
              </div>
              {lastSync && (
                <p className="text-xs text-gray-500">Last sync: {lastSync}</p>
              )}
              <WondeConnectButton connected />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-sm text-gray-500">Not connected</span>
              </div>
              <p className="text-xs text-gray-400">
                Supported MIS: SIMS, Arbor, Bromcom, ScholarPack, iSAMS, and more via Wonde.
              </p>
              <WondeConnectButton connected={false} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
