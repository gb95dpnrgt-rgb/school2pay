import Link from "next/link";

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated: 3 July 2026</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Note:</strong> These terms should be reviewed by a solicitor before the service is made available to schools. Company registration details must be inserted before go-live.
        </div>

        {[
          {
            title: "1. About School2Pay",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                <p>School2Pay is operated by <strong>[COMPANY LEGAL NAME]</strong>, registered in England and Wales (company number <strong>[NUMBER]</strong>), registered address <strong>[ADDRESS]</strong>.</p>
                <p>School2Pay is a payment collection platform that enables UK schools and trusts to collect payments from parents and guardians for school trips, clubs, activities, and other school-related charges. It is not a payment institution — payments are processed by Stripe, Inc.</p>
              </div>
            ),
          },
          {
            title: "2. Who these terms apply to",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                <p>These terms apply to:</p>
                <ul className="space-y-1 ml-4">
                  <li className="flex gap-2"><span className="text-blue-500">•</span><span><strong>Schools and trusts</strong> (&ldquo;schools&rdquo;) that use the School2Pay admin portal to create and manage payment requests.</span></li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span><span><strong>Parents and guardians</strong> who use a School2Pay payment link to pay for a school activity.</span></li>
                </ul>
                <p>By using School2Pay, you agree to these terms.</p>
              </div>
            ),
          },
          {
            title: "3. The service",
            content: (
              <ul className="space-y-2 text-sm text-gray-600">
                {[
                  "Schools can create payment requests and assign them to students. Parents receive a secure personal payment link by email.",
                  "Card payments are processed by Stripe, Inc. on behalf of the school (the merchant of record). School2Pay takes a 50p application fee per successful transaction.",
                  "School2Pay provides an optional digital consent form feature. Schools are responsible for ensuring consent forms comply with their own safeguarding policies.",
                  "School2Pay is provided as a software service. We do not guarantee uninterrupted availability but aim for 99.5% uptime.",
                  "We reserve the right to suspend access to any school that misuses the platform or violates these terms.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span>{item}</li>
                ))}
              </ul>
            ),
          },
          {
            title: "4. Fees and payments",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                <p><strong>For schools:</strong> School2Pay charges no setup fee, no monthly fee, and no annual licence. The only charge is a <strong>50p application fee per successful transaction</strong>, deducted at source by Stripe alongside Stripe&rsquo;s own processing fee.</p>
                <p><strong>For parents:</strong> Parents pay the amount set by the school. No surcharges are added to parent payments. Surcharging consumer card payments has been illegal in the UK since January 2018 and School2Pay does not do it.</p>
                <p><strong>Refunds:</strong> Schools can initiate refunds through the admin portal. Stripe&rsquo;s processing fee is non-refundable. School2Pay&rsquo;s 50p fee is non-refundable.</p>
              </div>
            ),
          },
          {
            title: "5. School responsibilities",
            content: (
              <ul className="space-y-2 text-sm text-gray-600">
                {[
                  "Schools are responsible for ensuring parent data uploaded to School2Pay is accurate and obtained lawfully.",
                  "Schools must sign a Data Processing Agreement (DPA) with School2Pay before going live with real parent data.",
                  "Schools are the merchant of record and are responsible for their Stripe connected account, including Stripe's terms of service.",
                  "Schools must not use School2Pay to collect payments for anything other than legitimate school activities.",
                  "Schools are responsible for their own safeguarding obligations in relation to consent form data.",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span>{item}</li>
                ))}
              </ul>
            ),
          },
          {
            title: "6. Parent rights",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                <p>Parents who have made a payment and wish to request a refund should contact their school directly. School2Pay cannot process refunds directly — only the school admin can initiate a refund.</p>
                <p>Parents who have submitted a consent form can withdraw their consent at any time via their payment link. Withdrawal of consent does not automatically entitle the parent to a refund — that is a matter between the parent and the school.</p>
              </div>
            ),
          },
          {
            title: "7. Limitation of liability",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                <p>School2Pay is provided &ldquo;as is&rdquo;. To the fullest extent permitted by law, we exclude all liability for indirect or consequential losses arising from use of the service.</p>
                <p>Our total liability to any school in any 12-month period shall not exceed the total application fees paid by that school in that period.</p>
                <p>Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.</p>
              </div>
            ),
          },
          {
            title: "8. Termination",
            content: (
              <div className="space-y-3 text-sm text-gray-600">
                <p>Schools may stop using School2Pay at any time. There are no cancellation fees or minimum terms.</p>
                <p>We may suspend or terminate access if a school breaches these terms, with reasonable notice except in cases of serious misuse.</p>
                <p>On termination, schools may request an export of their data. Data will be retained for the periods set out in our Privacy Notice.</p>
              </div>
            ),
          },
          {
            title: "9. Governing law",
            content: (
              <p className="text-sm text-gray-600">These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
            ),
          },
          {
            title: "10. Contact",
            content: (
              <p className="text-sm text-gray-600">
                For questions about these terms, email <strong>hello@school2pay.com</strong>.
              </p>
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
