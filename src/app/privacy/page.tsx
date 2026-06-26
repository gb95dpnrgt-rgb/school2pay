export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-gray">
        {/* ⚠ SOLICITOR REVIEW REQUIRED before go-live — see notice at bottom */}

        <div className="mb-10 rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-4 not-prose">
          <p className="text-sm font-bold text-amber-800">⚠ DRAFT — NOT YET APPROVED FOR PUBLICATION</p>
          <p className="text-sm text-amber-700 mt-1">
            This privacy notice has not been reviewed by a solicitor. It must be reviewed and
            approved by qualified legal counsel before the service is made available to the public.
            It is placeholder text only.
          </p>
        </div>

        <h1>Privacy Notice</h1>
        <p className="text-sm text-gray-500">Last updated: [DATE — to be set at launch]</p>

        <h2>1. Who we are</h2>
        <p>
          School2Pay is operated by [COMPANY LEGAL NAME], registered in England and Wales
          (company number [NUMBER]), registered address [ADDRESS] (<strong>"we"</strong>,{" "}
          <strong>"us"</strong>, <strong>"our"</strong>).
        </p>
        <p>
          We are the data processor for the school or trust (the <strong>"school"</strong>)
          that has engaged us to provide payment collection services. The school is the data
          controller for parent and pupil data.
        </p>

        <h2>2. What personal data we hold</h2>
        <p>We collect and process only the minimum data necessary to operate the service:</p>
        <ul>
          <li>
            <strong>Pupils:</strong> first name and year group only. We do not store surnames,
            dates of birth, addresses, medical information, or photographs.
          </li>
          <li>
            <strong>Parents and guardians:</strong> email address and, optionally, mobile phone
            number. These are provided by the school from their existing records.
          </li>
          <li>
            <strong>Payment information:</strong> we do not store card details. Card payments
            are processed by Stripe, Inc., which is PCI DSS compliant. We store a reference
            to each completed payment (Stripe payment intent ID) and the amount in pence.
          </li>
          <li>
            <strong>School administrators:</strong> name and email address (linked to their
            Supabase authentication account).
          </li>
        </ul>

        <h2>3. How we use your data</h2>
        <ul>
          <li>To send parents a payment link by email for school trips, clubs, and similar activities.</li>
          <li>To process card payments via Stripe on behalf of the school.</li>
          <li>To provide schools with a record of who has paid and who has not.</li>
          <li>To send transactional emails (payment confirmations, reminders) via Resend.</li>
        </ul>
        <p>We do not use personal data for marketing, profiling, or any purpose beyond operating the payment service.</p>

        <h2>4. Legal basis for processing</h2>
        <p>
          We process personal data on the basis of <strong>legitimate interests</strong> of the
          school in collecting payments for activities it provides to pupils, and on the basis
          of the <strong>performance of a contract</strong> (the school&rsquo;s agreement with us).
          [SOLICITOR TO CONFIRM CORRECT UK GDPR BASIS]
        </p>

        <h2>5. Data retention</h2>
        <p>
          Payment records are retained for [7] years in line with HMRC requirements. Parent
          contact details are deleted [30 days] after a pupil leaves the school, or on request
          from the school. [SOLICITOR TO CONFIRM PERIODS]
        </p>

        <h2>6. Third-party processors</h2>
        <ul>
          <li>
            <strong>Stripe, Inc.</strong> — card payment processing. Stripe is certified to
            PCI Service Provider Level 1. Data may be transferred to the USA under Stripe&rsquo;s
            Standard Contractual Clauses.
          </li>
          <li>
            <strong>Supabase, Inc.</strong> — database hosting (EU region). [CONFIRM REGION
            AND DPA IN PLACE]
          </li>
          <li>
            <strong>Resend, Inc.</strong> — transactional email delivery. [CONFIRM DPA]
          </li>
          <li>
            <strong>Vercel, Inc.</strong> — application hosting. [CONFIRM DPA AND REGION]
          </li>
        </ul>

        <h2>7. Your rights</h2>
        <p>
          Under UK GDPR, you have the right to access, correct, or erase your personal data;
          to restrict or object to processing; and to data portability. To exercise these
          rights, contact the school in the first instance, or email us at{" "}
          [PRIVACY EMAIL ADDRESS].
        </p>

        <h2>8. Cookies</h2>
        <p>
          We use only essential session cookies required to keep you logged in as a school
          administrator. We do not use analytics, advertising, or third-party tracking cookies.
        </p>

        <h2>9. Contact and complaints</h2>
        <p>
          Our data protection contact is [NAME / DPO EMAIL]. You have the right to lodge a
          complaint with the Information Commissioner&rsquo;s Office (ICO) at{" "}
          <a href="https://ico.org.uk" className="text-blue-600 underline">ico.org.uk</a>.
        </p>

        <div className="mt-12 rounded-xl border-2 border-amber-300 bg-amber-50 px-6 py-4 not-prose">
          <p className="text-sm font-bold text-amber-800">⚠ SOLICITOR REVIEW CHECKLIST</p>
          <ul className="mt-2 text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li>Confirm data controller / processor relationship with each school</li>
            <li>Confirm correct UK GDPR legal basis for each processing activity</li>
            <li>Confirm retention periods comply with HMRC, DfE, and school policies</li>
            <li>Confirm DPA agreements in place with Supabase, Resend, Vercel, Stripe</li>
            <li>Confirm data transfers outside UK/EEA are covered by appropriate safeguards</li>
            <li>Insert company registration details, registered address, DPO contact</li>
            <li>Remove this draft warning before publishing</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
