import { APPLICATION_FEE_PENCE, STRIPE_PERCENT, STRIPE_FIXED_PENCE, feeBreakdown, formatPence, grossUpToNet } from "@/lib/fees";

// Example figures derived from lib/fees so they stay in sync if constants change
const EXAMPLE_CHARGE = 2500; // £25.00 parent pays
const bd = feeBreakdown(EXAMPLE_CHARGE);
const GROSS_UP_EXAMPLE_CHARGE = grossUpToNet(EXAMPLE_CHARGE); // derived — updates automatically if fees change

export default function FeesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-gray-900">School2Pay</span>
          <span aria-hidden="true" className="text-gray-300">|</span>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Dashboard</a>
        </div>
        <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Back to dashboard</a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">What it costs — to the penny</h1>
          <p className="mt-3 text-gray-600">
            School2Pay has no setup fee and no monthly minimum on the Free plan. You pay one simple
            charge per parent payment, and it's deducted automatically before money reaches your bank
            — there's nothing to invoice, reconcile or chase.
          </p>
        </div>

        <div>
          <p className="text-gray-700 mb-4">
            Here's exactly what happens when a parent pays {formatPence(EXAMPLE_CHARGE)}:
          </p>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600"></th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Parent pays</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{formatPence(EXAMPLE_CHARGE)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">
                    Card processing (Stripe: {(STRIPE_PERCENT * 100).toFixed(1)}% + {formatPence(STRIPE_FIXED_PENCE)})
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    −{formatPence(Math.ceil(EXAMPLE_CHARGE * STRIPE_PERCENT) + STRIPE_FIXED_PENCE)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">School2Pay fee (flat)</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">−{formatPence(APPLICATION_FEE_PENCE)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">Lands in your school's bank (net)</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700">{formatPence(bd.netPence)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            That's it. No hidden percentages, no annual "per pupil" licence creeping up each year.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Want to receive the full amount?</h2>
          <p className="text-gray-600">
            Most schools simply build the cost into the price — the same way you'd build in coach
            hire or entry tickets. As a rule of thumb, add about 4% to your target amount.
          </p>
          <p className="text-gray-600">
            To receive exactly {formatPence(EXAMPLE_CHARGE)} per pupil, charge {formatPence(GROSS_UP_EXAMPLE_CHARGE)}.
          </p>
          <p className="text-gray-600">
            You don't need to do the maths: when you create a payment request, School2Pay shows you
            exactly what you'll receive per pupil as you type — and a one-click "Set price so we
            receive £X" button does the calculation for you.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">Why don't we just add a card fee at checkout?</h2>
          <p className="text-gray-600">
            Because it's against the law. Adding a surcharge to consumer card payments has been
            banned in the UK since 2018. Any provider doing this is exposing your school to risk.
            We keep you compliant by design: the price the parent sees is the price the parent pays.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900">When does the money arrive?</h2>
          <p className="text-gray-600">
            Payments are paid out to your school's bank account automatically on a rolling schedule
            (typically 2–3 working days after the parent pays). Every payout comes with a
            reconciliation report showing gross, fees and net — matched to the penny against your
            bank statement.
          </p>
          <p className="text-gray-600">
            Questions about fees? Email support — a human will reply with actual numbers, not a brochure.
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 border border-blue-100 p-5">
          <p className="text-sm text-blue-800 font-medium">Ready to create your first payment request?</p>
          <a href="/requests/new" className="mt-2 inline-block text-sm text-blue-700 underline hover:text-blue-900">
            Create a payment request →
          </a>
        </div>
      </div>

      <footer className="border-t border-gray-200 py-6 px-6 mt-12">
        <div className="max-w-2xl mx-auto flex justify-between text-xs text-gray-400">
          <span>School2Pay</span>
          <a href="/fees" className="underline">Fee schedule</a>
        </div>
      </footer>
    </main>
  );
}
