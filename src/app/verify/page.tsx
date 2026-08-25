import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function VerifyPage({
  searchParams,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchParams: Promise<any>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage message="No verification token provided." />;
  }

  const admin = getAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: record } = await (admin as any)
    .from("email_verifications")
    .select("user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("email_verifications")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  // Confirm the user's email
  const { error: confirmError } = await admin.auth.admin.updateUserById(record.user_id, {
    email_confirm: true,
  });

  if (confirmError) {
    console.error("Failed to confirm email:", confirmError);
    return <ErrorPage message="Failed to verify your email. Please contact support." />;
  }

  redirect("/login?verified=1");
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
