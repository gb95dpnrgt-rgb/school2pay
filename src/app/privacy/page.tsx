import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">S2</span>
            </div>
            <span className="font-bold text-gray-900">School2Pay</span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Back</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Notice</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated: 3 July 2026</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Note:</strong> This privacy notice should be reviewed by a solicitor before the service is made available to schools. Company registration details and DPO contact must be inserted before go-live.
        </div>

        {[
          {
            title: "1. Who we are",
            content: (
              <>
                <p>School2Pay is operated by <strong>[COMPANY LEGAL NAME]</strong>, registered in England and Wales (company number <strong>[NUMBER]</strong>), registered address <strong>[ADDRESS]</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).</p>
                <p className="mt-3">We act as a <strong>data processor</strong> on behalf of the school or trust (the &ldquo;school&rdquo;) that has engaged us to provide payment collection services. The school is the <strong>data controller</strong> for parent and pupil data.</p>
                <p className="mt-3">We are registered with the Information Commissioner&rsquo;s Office (ICO), registration number <strong>[ICO NUMBER]</strong>.</p>
              </>
            ),
          },
          {
            title: "2. What personal data we collect",
            content: (
              <ul className="space-y-3 list-none">
                {[
                  { who: "Pupils", what: "First name and year group only. We never store surnames, dates of birth, home addresses, or photographs." },
                  { who: "Parents and guardians", what: "Email address and, optionally, mobile phone number. These are provided by the school from their existing records." },
                  { who: "Consent form responses", what: "Where a school attaches a consent form to a trip payment, parents may submit medical conditions, dietary requirements, and emergency contact details. This is special category data under UK GDPR Art. 9 and is treated with additional safeguards." },
                  { who: "Payment data", what: "We do not store card numbers. Payments are processed by Stripe (PCI DSS Level 1). We store a Stripe payment reference and the amount in pence." },
                  { who: "School administrators", what: "Name and email address, used to log in to the School2Pay admin portal." },
                ].map((item) => (
                  <li key={item.who} className="border-l-4 border-blue-100 pl-4">
                    <p className="font-semibold text-gray-800">{item.who}</p>
                    <p className="text-gray-600 text-sm mt-0.5">{item.what}</p>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            title: "3. How we use your data",
            content: (
              <ul className="space-y-2 text-gray-600">
                {[
                  "To send parents a secure, personal payment link by email for school trips, clubs, and activities.",
                  "To process card payments via Stripe on behalf of the school.",
                  "To collect and securely store digital consent form responses submitted by parents.",
                  "To provide the school with a real-time record of payments and consent status.",
                  "To send transactional emails — payment confirmations and automated reminders — via Resend.",
                  "To send SMS reminders where a mobile number is held and the school has enabled this feature.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-500 mt-0.5">•</span> {item}
                  </li>
                ))}
                <li className="text-sm text-gray-500 mt-2 italic">We do not use personal data for marketing, profiling, or any purpose beyond operating the payment service.</li>
              </ul>
            ),
          },
          {
            title: "4. Legal basis for processing",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                <p><strong className="text-gray-800">Standard personal data</strong> (name, email, payment records): processed on the basis of <strong>legitimate interests</strong> of the school in collecting payments for activities it provides, and <strong>performance of a contract</strong> between the school and School2Pay.</p>
                <p><strong className="text-gray-800">Special category data</strong> (medical conditions, dietary requirements): processed on the basis of <strong>explicit consent</strong> given by the parent when signing the digital consent form (UK GDPR Art. 9(2)(a)).</p>
              </div>
            ),
          },
          {
            title: "5. Data retention",
            content: (
              <div className="space-y-2 text-sm text-gray-600">
                {[
                  { type: "Payment records", period: "7 years (HMRC requirement)" },
                  { type: "Parent contact details", period: "Deleted within 30 days of the school requesting removal, or when a pupil leaves the school" },
                  { type: "Consent form responses (medical/dietary)", period: "Automatically deleted 1 year after the trip due date" },
                  { type: "School admin accounts", period: "Deleted within 30 days of account closure" },
                ].map((item) => (
                  <div key={item.type} className="flex gap-3">
                    <span className="font-medium text-gray-800 w-56 shrink-0">{item.type}</span>
                    <span>{item.period}</span>
                  </div>
                ))}
              </div>
            ),
          },
          {
            title: "6. Third-party processors",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                {[
                  { name: "Stripe, Inc.", purpose: "Card payment processing", note: "PCI DSS Level 1 certified. Data may be transferred to the USA under Standard Contractual Clauses." },
                  { name: "Supabase, Inc.", purpose: "Database hosting", note: "EU region (Frankfurt). Data Processing Agreement in place." },
                  { name: "Resend, Inc.", purpose: "Transactional email delivery", note: "Data Processing Agreement in place." },
                  { name: "Vercel, Inc.", purpose: "Application hosting", note: "EU region. Data Processing Agreement in place." },
                  { name: "Twilio, Inc.", purpose: "SMS notifications (optional)", note: "Only used where school has enabled SMS reminders." },
                ].map((p) => (
                  <div key={p.name} className="border-l-4 border-gray-100 pl-4">
                    <p className="font-semibold text-gray-800">{p.name} — {p.purpose}</p>
                    <p className="text-gray-500 mt-0.5">{p.note}</p>
                  </div>
                ))}
              </div>
            ),
          },
          {
            title: "7. Your rights",
            content: (
              <div className="space-y-2 text-sm text-gray-600">
                <p>Under UK GDPR you have the right to:</p>
                <ul className="space-y-1 ml-4">
                  {[
                    "Access the personal data we hold about you",
                    "Correct inaccurate data",
                    "Erase your data (where no legal obligation to retain it exists)",
                    "Restrict or object to processing",
                    "Withdraw consent for special category data at any time",
                    "Data portability",
                  ].map((r, i) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-blue-500">•</span>{r}</li>
                  ))}
                </ul>
                <p className="mt-3">To exercise these rights, contact your school in the first instance, or email us at <strong>privacy@school2pay.com</strong>.</p>
              </div>
            ),
          },
          {
            title: "8. Cookies",
            content: (
              <p className="text-sm text-gray-600">We use only essential session cookies required to keep school administrators logged in. We do not use analytics, advertising, or third-party tracking cookies.</p>
            ),
          },
          {
            title: "9. Contact and complaints",
            content: (
              <div className="space-y-2 text-sm text-gray-600">
                <p>For privacy queries: <strong>privacy@school2pay.com</strong></p>
                <p>You have the right to lodge a complaint with the Information Commissioner&rsquo;s Office (ICO) at <a href="https://ico.org.uk" className="text-blue-600 underline">ico.org.uk</a> or by calling 0303 123 1113.</p>
              </div>
            ),
          },
        ].map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">{section.title}</h2>
            <div>{section.content}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
