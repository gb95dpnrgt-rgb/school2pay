export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-gray">
        {/* ⚠ SOLICITOR REVIEW REQUIRED before go-live — see notice at bottom */}

        <div className="mb-10 rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-4 not-prose">
          <p className="text-sm font-bold text-amber-800">⚠ DRAFT — NOT YET APPROVED FOR PUBLICATION</p>
          <p className="text-sm text-amber-700 mt-1">
            These terms have not been reviewed by a solicitor. They must be reviewed and approved
            by qualified legal counsel before the service is made available to the public.
            This is placeholder text only.
          </p>
        </div>

        <h1>Terms of Service</h1>
        <p className="text-sm text-gray-500">Last updated: [DATE — to be set at launch]</p>

        <h2>1. Parties</h2>
        <p>
          These terms govern the relationship between [COMPANY LEGAL NAME] (<strong>"School2Pay"</strong>,
          <strong>"we"</strong>, <strong>"us"</strong>) and the school or trust
          (<strong>"the School"</strong>) that has subscribed to use the School2Pay platform.
        </p>
        <p>
          These terms do not create a contract between School2Pay and individual parents or
          guardians. The School is responsible for its own relationship with parents.
        </p>

        <h2>2. The service</h2>
        <p>
          School2Pay provides software that enables schools to create payment requests and
          collect card payments from parents for school activities (trips, clubs, dinners,
          uniform, and similar). School2Pay is not a bank, payment institution, or
          financial services firm. Card payments are processed by Stripe, Inc. under
          Stripe&rsquo;s own terms of service.
        </p>

        <h2>3. Fees</h2>
        <p>
          School2Pay charges a platform fee of <strong>50p per successful card transaction</strong>{" "}
          (the <strong>"Application Fee"</strong>), deducted at source from each payout by
          Stripe. Stripe&rsquo;s own processing fee (~1.5% + 20p for standard UK consumer cards)
          is also deducted at source.
        </p>
        <p>
          <strong>No surcharging:</strong> the School must never add a card-processing surcharge
          to the amount presented to parents. Surcharging consumer card payments has been
          prohibited under UK law since 13 January 2018 (Payment Services Regulations 2017).
          School2Pay&rsquo;s fee structure is designed to be borne by the School.
        </p>
        <p>[SOLICITOR TO REVIEW: confirm fee model, VAT position, invoicing arrangement]</p>

        <h2>4. Connected accounts (Stripe)</h2>
        <p>
          To receive payouts, the trust must complete Stripe&rsquo;s Know Your Customer (KYC)
          onboarding and agree to{" "}
          <a href="https://stripe.com/gb/connect-account/legal" className="text-blue-600 underline">
            Stripe&rsquo;s Connected Account Agreement
          </a>. The trust is the merchant of record for each payment. School2Pay acts as the
          platform operator.
        </p>

        <h2>5. Data protection</h2>
        <p>
          The School is the data controller for all personal data relating to pupils and parents.
          School2Pay acts as a data processor on the School&rsquo;s behalf. A Data Processing
          Agreement (DPA) [to be attached as Schedule 1] forms part of these terms.
          [SOLICITOR TO DRAFT DPA]
        </p>

        <h2>6. Acceptable use</h2>
        <p>The School agrees not to use School2Pay to collect payment for:</p>
        <ul>
          <li>tuition fees or any amount that would constitute a charge for state education;</li>
          <li>activities that are unlawful, fraudulent, or not connected with the school&rsquo;s educational purpose;</li>
          <li>any amount that would breach the School&rsquo;s own charging and remissions policy.</li>
        </ul>

        <h2>7. Limitation of liability</h2>
        <p>
          [SOLICITOR TO DRAFT — standard SaaS limitation clauses, indemnities, consequential
          loss exclusion, etc.]
        </p>

        <h2>8. Termination</h2>
        <p>
          Either party may terminate with [30] days&rsquo; written notice. On termination, the
          School&rsquo;s data will be retained for [90] days and then deleted, except where
          retention is required by law.
          [SOLICITOR TO CONFIRM]
        </p>

        <h2>9. Governing law</h2>
        <p>
          These terms are governed by the law of England and Wales. Any disputes shall be
          subject to the exclusive jurisdiction of the courts of England and Wales.
        </p>

        <h2>10. Contact</h2>
        <p>
          Legal notices: [COMPANY ADDRESS].<br />
          General enquiries: [CONTACT EMAIL]
        </p>

        <div className="mt-12 rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-4 not-prose">
          <p className="text-sm font-bold text-amber-800">⚠ SOLICITOR REVIEW CHECKLIST</p>
          <ul className="mt-2 text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li>Insert company registration details and registered address</li>
            <li>Confirm fee model and VAT treatment</li>
            <li>Draft and attach Data Processing Agreement (Schedule 1)</li>
            <li>Draft limitation of liability and indemnity clauses</li>
            <li>Confirm the no-surcharging clause and its scope</li>
            <li>Review termination and data deletion terms</li>
            <li>Confirm Stripe Connected Account Agreement reference is current</li>
            <li>Review acceptable use clause against DfE guidance</li>
            <li>Remove this draft warning before publishing</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
