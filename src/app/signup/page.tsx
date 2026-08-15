import { signup } from "./actions";

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-gray-900">School2Pay</a>
        <a href="/login" className="text-sm text-gray-500 hover:text-gray-800">Sign in</a>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Get started with School2Pay</h1>
            <p className="mt-2 text-sm text-gray-500">
              Set up your school in minutes. No contract, no setup fee.
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-xl shadow p-8 space-y-5">
            <ErrorMessage searchParams={searchParams} />

            <form action={signup} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Work email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@yourschool.co.uk"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Create account →
              </button>
            </form>

            <p className="text-center text-xs text-gray-400">
              By signing up you agree to our{" "}
              <a href="/terms" className="underline hover:text-gray-600">terms of service</a>
              {" "}and{" "}
              <a href="/privacy" className="underline hover:text-gray-600">privacy policy</a>.
            </p>
          </div>

          {/* What happens next */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What happens next</p>
            <ol className="space-y-2">
              {[
                "Create your account",
                "Tell us about your school",
                "Connect your bank account via Stripe (5–10 mins)",
                "Start collecting payments from parents",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:underline font-medium">Sign in</a>
          </p>
        </div>
      </div>
    </main>
  );
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (!params.error) return null;
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      {params.error}
    </div>
  );
}
