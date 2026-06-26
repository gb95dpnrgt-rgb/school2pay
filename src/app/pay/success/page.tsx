export default function PaySuccessPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-xl border border-gray-200 bg-white p-8 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Payment received</h1>
        <p className="text-sm text-gray-500">
          Your payment is being verified — you will receive a confirmation email shortly. You may close this page.
        </p>
        <p className="text-xs text-gray-400">
          Verification is automatic and usually takes a few seconds.
        </p>
      </div>
    </main>
  );
}
