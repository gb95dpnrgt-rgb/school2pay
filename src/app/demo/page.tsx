import Link from "next/link";

export default function DemoHome() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">S2</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to the School2Pay demo</h1>
          <p className="mt-3 text-gray-500">
            Explore the full admin experience for <strong>Oakwood Primary School</strong> — sample data, no login needed.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 text-left shadow-sm">
          <p className="text-sm font-semibold text-gray-700">What you can explore:</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {[
              "Admin dashboard with live collection stats",
              "Payment requests with student-level tracking",
              "Digital consent form responses",
              "CSV export with consent data included",
              "Parent payment page (use test card 4242 4242 4242 4242)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">✓</span> {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/demo/dashboard"
            className="block rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
          >
            Enter demo →
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← Back to school2pay.com
          </Link>
        </div>
      </div>
    </main>
  );
}
