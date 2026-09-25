import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import ResetPasswordForm from "./ResetPasswordForm";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage message="No reset token provided." />;
  }

  const admin = getAdmin();
  const { data: record } = await (admin as any)
    .from("password_resets")
    .select("user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!record) return <ErrorPage message="This reset link is invalid." />;
  if (record.used_at) return <ErrorPage message="This reset link has already been used." />;
  if (new Date(record.expires_at) < new Date()) return <ErrorPage message="This reset link has expired. Request a new one." showForgot />;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a strong password for your account.</p>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}

function ErrorPage({ message, showForgot = false }: { message: string; showForgot?: boolean }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 space-y-4 text-center">
        <p className="text-red-600 font-medium">{message}</p>
        {showForgot && (
          <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Request a new reset link →
          </a>
        )}
        {!showForgot && (
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            Back to sign in
          </a>
        )}
      </div>
    </main>
  );
}
