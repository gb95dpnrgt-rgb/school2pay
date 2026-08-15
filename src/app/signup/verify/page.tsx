export default function VerifyPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <span className="text-lg font-bold text-gray-900">School2Pay</span>
      </nav>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-5 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-3xl">
            📧
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
            <p className="text-sm text-gray-500">
              We&apos;ve sent a verification link to your email address. Click the link to confirm your account and continue setting up your school.
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-500 text-left space-y-1">
            <p className="font-medium text-gray-700">Didn&apos;t receive it?</p>
            <p>Check your spam or junk folder. The email comes from <span className="font-medium">payments@school2pay.com</span>.</p>
          </div>
          <p className="text-xs text-gray-400">
            Already verified?{" "}
            <a href="/login" className="text-blue-600 hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </main>
  );
}
