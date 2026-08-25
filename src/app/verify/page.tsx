import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/types";
import Link from "next/link";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage message="No verification token provided." />;
  }

  const admin = getAdmin();

  // Look up the token
  const { data: record } = await (admin.from("email_verifications" as keyof Database["public"]["Tables"]) as never as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { user_id: string; expires_at: string; used_at: string | null } | null }>;
      };
    };
  }).select("user_id, expires_at, used_at").eq("token", token).maybeSingle();

  if (!record) {
    return <ErrorPage message="This verification link is invalid." />;
  }
  if (record.used_at) {
    return <ErrorPage message="This verification link has already been used. Please sign in." showLogin />;
  }
  if (new Date(record.expires_at) < new Date()) {
    return <ErrorPage message="This verification link has expired. Please sign up again." />;
  }

  // Mark token as used
  await (admin.from("email_verifications" as keyof Database["public"]["Tables"]) as never as {
    update: (data: object) => { eq: (col: string, val: string) => Promise<unknown> };
  }).update({ used_at: new Date().toISOString() }).eq("token", token);

  // Confirm the user's email
  const { error: confirmError } = await admin.auth.admin.updateUserById(record.user_id, {
    email_confirm: true,
  });

  if (confirmError) {
    console.error("Failed to confirm email:", confirmError);
    return <ErrorPage message="Failed to verify your email. Please contact support." />;
  }

  // Auto sign-in the user so they land straight on onboarding
  // We need their email to sign in — fetch it
  const { data: { user } } = await admin.auth.admin.getUserById(record.user_id);
  if (!user?.email) {
    return <SuccessPage />;
  }

  // We can't sign in with password here (we don't have it server-side).
  // Instead redirect to login with a success message.
  redirect(`/login?verified=1`);
}

function ErrorPage({ message, showLogin }: { message: string; showLogin?: boolean }) {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="text-lg font-bold text-gray-900">School2Pay</span>
      </nav>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-50 flex items-center justify-center text-3xl">❌</div>
          <h1 className="text-xl font-bold text-gray-900">Verification failed</h1>
          <p className="text-sm text-gray-500">{message}</p>
          {showLogin && (
            <Link href="/login" className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function SuccessPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="text-lg font-bold text-gray-900">School2Pay</span>
      </nav>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-green-50 flex items-center justify-center text-3xl">✅</div>
          <h1 className="text-xl font-bold text-gray-900">Email confirmed!</h1>
          <p className="text-sm text-gray-500">Your account is ready. Sign in to continue setting up your school.</p>
          <Link href="/login" className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
