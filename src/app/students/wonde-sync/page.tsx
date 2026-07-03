import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import WondeSyncClient from "./WondeSyncClient";

export default async function WondeSyncPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: school } = await supabase.from("schools").select("id, name").single();

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

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <a href="/students" className="text-sm text-gray-400 hover:text-gray-600">← Back to students</a>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Sync from MIS via Wonde</h1>
          <p className="mt-1 text-sm text-gray-500">{school?.name}</p>
          <p className="mt-2 text-sm text-gray-600">
            Wonde connects to your school&apos;s MIS (SIMS, Arbor, Bromcom, iSAMS and more) and pulls student and parent data automatically — no CSV needed.
          </p>
        </div>

        {/* How it works */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { step: "1", title: "Enter your Wonde credentials", body: "API token and school ID from your Wonde dashboard." },
            { step: "2", title: "Preview the import", body: "See exactly which students and guardians will be imported before confirming." },
            { step: "3", title: "Auto-sync nightly", body: "Once connected, students are kept up to date automatically every night." },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">{s.step}</div>
              <p className="text-sm font-semibold text-gray-900">{s.title}</p>
              <p className="text-xs text-gray-500">{s.body}</p>
            </div>
          ))}
        </div>

        {/* MIS compatibility */}
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Compatible MIS systems</p>
          <div className="flex flex-wrap gap-2">
            {["SIMS", "Arbor", "Bromcom", "iSAMS", "ScholarPack", "Pupil Asset", "My School Portal", "Progresso"].map((mis) => (
              <span key={mis} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{mis}</span>
            ))}
          </div>
        </div>

        {/* The form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Connect your MIS</h2>
          <WondeSyncClient />
        </div>
      </div>
    </main>
  );
}
