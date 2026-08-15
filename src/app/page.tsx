import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-white text-gray-900">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S2</span>
            </div>
            <span className="font-bold text-lg text-gray-900">School2Pay</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900">How it works</a>
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
              Sign in
            </Link>
            <a
              href="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Get started
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm text-blue-700 font-medium">
          Built for UK schools · No setup fee
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
          School payments.<br />
          <span className="text-blue-600">Done properly.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-gray-500 leading-relaxed">
          Collect trip payments, club fees, and consent forms in one place.
          Parents pay in seconds. Schools get the money — and the paperwork — automatically.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/signup"
            className="rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
          >
            Get started free
          </a>
          <a
            href="#how-it-works"
            className="rounded-xl border border-gray-200 px-8 py-4 text-base font-semibold text-gray-700 hover:bg-gray-50"
          >
            See how it works
          </a>
        </div>
        <p className="text-sm text-gray-400">
          No contracts · No setup fee · Cancel any time
        </p>
      </section>

      {/* ── Social proof strip ──────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-4">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">Designed for</p>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500 font-medium">
            <span>Primary schools</span>
            <span>·</span>
            <span>Secondary schools</span>
            <span>·</span>
            <span>Independent schools</span>
            <span>·</span>
            <span>Multi-Academy Trusts</span>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24 space-y-16">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Everything in one place</h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            No more chasing paper slips, lost letters, or cash in envelopes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: "💳",
              title: "Instant card payments",
              body: "Parents pay by card in under 60 seconds — no app to download, no account to create. Just a link.",
            },
            {
              icon: "📋",
              title: "Digital consent forms",
              body: "Consent forms built into the payment flow. Emergency contacts, medical info, and signatures — all collected and stored securely.",
            },
            {
              icon: "📧",
              title: "Automatic reminders",
              body: "Unpaid? The system chases parents for you. Email reminders go out automatically so your staff don't have to.",
            },
            {
              icon: "📊",
              title: "Real-time dashboard",
              body: "See who's paid, who hasn't, and how much you've collected — live. Export to CSV in one click for your finance team.",
            },
            {
              icon: "🔒",
              title: "GDPR compliant",
              body: "Children's data is school-scoped and encrypted. Medical information is flagged as special-category data and auto-deleted after the trip.",
            },
            {
              icon: "💰",
              title: "Transparent pricing",
              body: "Schools pay nothing. Parents pay nothing extra. We take 50p per transaction — that's it. No hidden fees, no annual licence.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-100 bg-white p-6 space-y-3 shadow-sm">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-blue-600 py-24">
        <div className="max-w-5xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-white">How it works</h2>
            <p className="text-lg text-blue-100 max-w-xl mx-auto">
              Up and running in minutes. No IT department needed.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Upload your students", body: "Import a simple CSV with first names, year groups, and parent email addresses." },
              { step: "2", title: "Create a payment request", body: "Set the trip name, amount, due date, and optional consent form. Done in under a minute." },
              { step: "3", title: "Parents get a link", body: "An email goes to every parent with a secure personal payment link — no login required." },
              { step: "4", title: "Money lands in school", body: "Stripe pays directly into the school's bank account. You see everything in your dashboard." },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold text-white">
                  {s.step}
                </div>
                <h3 className="font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-blue-100 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 py-24 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Simple, honest pricing</h2>
          <p className="text-lg text-gray-500">Schools pay nothing. Ever.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="rounded-2xl border-2 border-blue-600 bg-white p-8 space-y-6 shadow-lg">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">For schools</p>
              <p className="mt-2 text-5xl font-extrabold text-gray-900">£0</p>
              <p className="mt-1 text-gray-500">per month, forever</p>
            </div>
            <ul className="space-y-3 text-sm text-gray-600">
              {[
                "Unlimited payment requests",
                "Unlimited students",
                "Digital consent forms",
                "Automatic email reminders",
                "CSV exports",
                "Real-time dashboard",
                "No setup fee",
                "No contract",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-green-500 font-bold">✓</span> {item}
                </li>
              ))}
            </ul>
            <a
              href="/signup"
              className="block text-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Get started free
            </a>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 space-y-6">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Per transaction</p>
              <p className="mt-2 text-5xl font-extrabold text-gray-900">50p</p>
              <p className="mt-1 text-gray-500">flat fee per payment</p>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <p>The 50p application fee covers our platform costs. Stripe's card processing fee (~1.5% + 20p) is separate and netted off at source.</p>
              <p className="font-medium text-gray-700">Example: a £25 trip payment costs the school approximately £1.08 in total fees — less than a stamp and an envelope.</p>
              <p className="text-gray-400 text-xs">UK consumer cards only. No surcharging to parents — illegal in the UK since 2018 and we don't do it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA / Contact ───────────────────────────────────────────────── */}
      <section id="contact" className="bg-gray-900 py-24">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white">Ready to see it in action?</h2>
          <p className="text-lg text-gray-400">
            Book a free 20-minute demo. We'll show you how to set up your first payment request and answer any questions your bursar has.
          </p>
          <a
            href="mailto:hello@school2pay.com"
            className="inline-block rounded-xl bg-white px-8 py-4 text-base font-semibold text-gray-900 hover:bg-gray-100 shadow-lg"
          >
            Email us at hello@school2pay.com
          </a>
          <p className="text-sm text-gray-500">
            Or call us — we're a small team and we answer the phone.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">S2</span>
            </div>
            <span>School2Pay</span>
          </div>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-gray-600">Privacy policy</a>
            <a href="/terms" className="hover:text-gray-600">Terms</a>
            <Link href="/login" className="hover:text-gray-600">School login</Link>
          </div>
          <p>© {new Date().getFullYear()} School2Pay. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
