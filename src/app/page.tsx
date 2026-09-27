import Link from "next/link";

export default function Home() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#FFFFFF", color: "#0F2240" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .outfit { font-family: 'Outfit', sans-serif; }
        .wm { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.35rem; letter-spacing: -0.02em; color: #1C3D6B; }
        .wm .two { color: #0DB89E; font-weight: 800; }
        .hero-wm { font-family: 'Outfit', sans-serif; font-weight: 700; letter-spacing: -0.03em; color: #fff; line-height: 1; font-size: clamp(2.6rem, 6vw, 4rem); }
        .hero-wm .two { color: #0DB89E; font-weight: 800; }
        .section-eyebrow { font-family: 'Inter', sans-serif; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #0A9882; margin-bottom: 12px; }
        .section-heading { font-family: 'Outfit', sans-serif; font-size: clamp(1.6rem, 3.5vw, 2.4rem); font-weight: 800; color: #1C3D6B; letter-spacing: -0.02em; text-wrap: balance; line-height: 1.15; margin-bottom: 16px; }
        .btn-primary { background: #0DB89E; color: #fff; font-size: 0.95rem; font-weight: 600; padding: 14px 28px; border-radius: 10px; text-decoration: none; display: inline-block; transition: background 0.15s; }
        .btn-primary:hover { background: #0A9882; }
        .btn-navy { background: #1C3D6B; color: #fff; font-size: 0.95rem; font-weight: 600; padding: 14px 28px; border-radius: 10px; text-decoration: none; display: inline-block; transition: background 0.15s; }
        .btn-navy:hover { background: #0F2240; }
        .btn-ghost { background: rgba(255,255,255,0.1); color: #fff; font-size: 0.95rem; font-weight: 500; padding: 14px 28px; border-radius: 10px; text-decoration: none; border: 1px solid rgba(255,255,255,0.25); display: inline-block; transition: background 0.15s; }
        .btn-ghost:hover { background: rgba(255,255,255,0.18); }
        .feature-card { background: #fff; border: 1px solid #DDE8F2; border-radius: 16px; padding: 32px; }
        .feature-icon { width: 48px; height: 48px; border-radius: 12px; background: #E4F7F4; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .feature-title { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; color: #1C3D6B; margin-bottom: 10px; }
        .feature-body { font-size: 0.875rem; color: #4E6480; line-height: 1.65; }
        .audience-card { background: #fff; border-radius: 16px; padding: 28px 30px; border-left: 4px solid #0DB89E; }
        .audience-role { font-family: 'Outfit', sans-serif; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0A9882; margin-bottom: 10px; }
        .audience-headline { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; color: #1C3D6B; margin-bottom: 8px; text-wrap: balance; }
        .trust-item { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; font-weight: 500; color: rgba(255,255,255,0.55); letter-spacing: 0.03em; text-transform: uppercase; }
        .trust-dot { width: 6px; height: 6px; border-radius: 50%; background: #0DB89E; flex-shrink: 0; }
        .step-num { font-family: 'Outfit', sans-serif; font-size: 3rem; font-weight: 800; color: #E4F7F4; line-height: 1; margin-bottom: 12px; display: block; }
        .step-title { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; color: #1C3D6B; margin-bottom: 8px; }
        .footer-brand .two { color: #0DB89E; font-weight: 800; }
        @media (max-width: 600px) {
          .hide-mobile { display: none !important; }
          .ctas { flex-direction: column; align-items: stretch; }
          .ctas a { text-align: center; }
        }
      `}</style>

      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#fff", borderBottom: "1px solid #DDE8F2" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 clamp(16px,5vw,48px)", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="34" height="34" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="100" height="100" rx="22" fill="#1C3D6B"/>
              <polygon points="50,17 74,30 50,41 26,30" fill="white"/>
              <rect x="37" y="41" width="26" height="15" rx="3" fill="white"/>
              <line x1="74" y1="30" x2="74" y2="51" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="74" cy="54.5" r="3.5" fill="#0DB89E"/>
              <rect x="24" y="64" width="52" height="20" rx="4" fill="none" stroke="white" strokeWidth="2.2"/>
              <rect x="31" y="70" width="10" height="7" rx="1.5" fill="white" opacity="0.9"/>
              <line x1="47" y1="70" x2="68" y2="70" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
              <line x1="47" y1="74" x2="62" y2="74" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <span className="wm">School<span className="two">2</span>Pay</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <a href="#features" className="hide-mobile" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#4E6480", textDecoration: "none" }}>Features</a>
            <a href="#how" className="hide-mobile" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#4E6480", textDecoration: "none" }}>How it works</a>
            <Link href="/login" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#4E6480", textDecoration: "none" }}>Sign in</Link>
            <a href="#contact" style={{ background: "#1C3D6B", color: "#fff", fontSize: "0.875rem", fontWeight: 600, padding: "8px 20px", borderRadius: 8, textDecoration: "none" }}>Request a demo</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ background: "#1C3D6B", padding: "clamp(64px,10vw,112px) clamp(16px,5vw,48px)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 110%, rgba(13,184,158,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28 }}>
          <svg width="64" height="64" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="100" height="100" rx="22" fill="rgba(255,255,255,0.12)"/>
            <polygon points="50,17 74,30 50,41 26,30" fill="white"/>
            <rect x="37" y="41" width="26" height="15" rx="3" fill="white"/>
            <line x1="74" y1="30" x2="74" y2="51" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="74" cy="54.5" r="3.5" fill="#0DB89E"/>
            <rect x="24" y="64" width="52" height="20" rx="4" fill="none" stroke="white" strokeWidth="2.2"/>
            <rect x="31" y="70" width="10" height="7" rx="1.5" fill="white" opacity="0.9"/>
            <line x1="47" y1="70" x2="68" y2="70" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
            <line x1="47" y1="74" x2="62" y2="74" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
          </svg>
          <div className="hero-wm">School<span className="two">2</span>Pay</div>
        </div>
        <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: "clamp(1.1rem,2.5vw,1.35rem)", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 20 }}>Smarter school payments</p>
        <p style={{ fontSize: "clamp(0.95rem,2vw,1.1rem)", color: "rgba(255,255,255,0.65)", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Replace cash envelopes, paper forms, and chased-up bank transfers with one secure platform. Parents pay in seconds. Schools get the money — and the record.
        </p>
        <div className="ctas" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#contact" className="btn-primary">Request a demo</a>
          <a href="#how" className="btn-ghost">See how it works</a>
        </div>
      </section>

      {/* TRUST BAR */}
      <div style={{ background: "#0F2240", padding: "20px clamp(16px,5vw,48px)", display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(20px,4vw,56px)", flexWrap: "wrap" }}>
        {["Built for UK schools & MATs", "Stripe-powered payments", "No card surcharges — ever", "GDPR-compliant safeguarding"].map(t => (
          <div key={t} className="trust-item"><span className="trust-dot" />{t}</div>
        ))}
      </div>

      {/* FEATURES */}
      <section id="features" style={{ background: "#F2F7FC", padding: "clamp(64px,8vw,100px) clamp(16px,5vw,48px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="section-eyebrow">What you get</p>
          <h2 className="section-heading">Everything a school needs.<br />Nothing it doesn&apos;t.</h2>
          <p style={{ fontSize: "1rem", color: "#4E6480", maxWidth: 520, lineHeight: 1.7, marginBottom: 52 }}>Purpose-built for UK school payment collection — trips, clubs, dinner money, uniforms, and more.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
            {[
              { title: "Instant payment requests", body: "Create a request in under a minute. Set the amount, due date, and assign it to individual students or whole year groups.", icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#0DB89E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
              { title: "Magic link checkout", body: "Parents receive a personalised, signed link by email. One click opens their checkout — no account, no app, no friction.", icon: <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="#0DB89E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
              { title: "Real-time reporting", body: "Live dashboards show gross collected, outstanding balances, and net income — labelled clearly for governors and finance leads.", icon: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="#0DB89E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
              { title: "Fully safeguarded", body: "We store only first names and year groups. No surnames, no dates of birth, no addresses. Children&apos;s data, handled properly.", icon: <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="#0DB89E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
              { title: "Transparent fees", body: "A flat platform fee plus Stripe&apos;s processing cost, netted off at source. Parents always pay exactly what they see — no surcharges.", icon: <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" stroke="#0DB89E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
              { title: "Exportable audit trail", body: "Every transaction, ledger entry, and refund is permanently recorded and exportable — ready for year-end audit at any time.", icon: <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke="#0DB89E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">{f.icon}</svg>
                </div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-body">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ background: "#fff", padding: "clamp(64px,8vw,100px) clamp(16px,5vw,48px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="section-eyebrow">How it works</p>
          <h2 className="section-heading">Up and running in minutes</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 40, marginTop: 52 }}>
            {[
              { n: "01", title: "Create a payment request", body: "Name the request, set the amount, choose the students. School2Pay generates individual payment links for each parent automatically." },
              { n: "02", title: "Parents receive a link", body: "A secure, single-use magic link lands in their inbox. They click, see exactly what they owe for which child, and pay by card in under a minute." },
              { n: "03", title: "Money lands in your account", body: "Stripe routes funds directly to your trust's bank account. The dashboard updates instantly. Finance has everything they need — no chasing required." },
            ].map(s => (
              <div key={s.n}>
                <span className="step-num">{s.n}</span>
                <div className="step-title">{s.title}</div>
                <div style={{ fontSize: "0.875rem", color: "#4E6480", lineHeight: 1.65 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ background: "#1C3D6B", padding: "clamp(56px,8vw,80px) clamp(16px,5vw,48px)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 40, textAlign: "center" }}>
          {[
            { val: "£0 surcharge", label: "Always. It's UK law." },
            { val: "<60s", label: "Parent checkout time" },
            { val: "100%", label: "Webhook-verified payments" },
            { val: "1 platform", label: "Trips, clubs, dinners & more" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: "clamp(1.8rem,3.5vw,2.6rem)", fontWeight: 800, color: "#0DB89E", lineHeight: 1, marginBottom: 6 }}>{s.val}</div>
              <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AUDIENCE */}
      <section style={{ background: "#F2F7FC", padding: "clamp(64px,8vw,100px) clamp(16px,5vw,48px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="section-eyebrow">Built for everyone in the school</p>
          <h2 className="section-heading">The right tool for every role</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 20, marginTop: 48 }}>
            {[
              { role: "School Admin", headline: "Spend less time chasing payments", body: "Create requests, track who has paid, waive individual assignments, and close requests — all from one screen." },
              { role: "Parents & Guardians", headline: "Pay for everything in one place", body: "No logins, no apps to download. A link in your email shows exactly what each child owes. Pay and you're done." },
              { role: "Finance Teams", headline: "Clean records, always audit-ready", body: "Gross, net, and fee figures labelled on every report. Full transaction history, exportable at any time." },
              { role: "Trust Leadership", headline: "Consistent collections across every school", body: "One connected Stripe account per trust. Funds flow directly to your bank. No manual reconciliation across sites." },
            ].map(a => (
              <div key={a.role} className="audience-card">
                <div className="audience-role">{a.role}</div>
                <div className="audience-headline">{a.headline}</div>
                <div style={{ fontSize: "0.875rem", color: "#4E6480", lineHeight: 1.65 }}>{a.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" style={{ background: "#fff", padding: "clamp(64px,8vw,100px) clamp(16px,5vw,48px)", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <p className="section-eyebrow">Get started</p>
          <h2 className="section-heading">Ready to simplify school payments?</h2>
          <p style={{ fontSize: "1rem", color: "#4E6480", lineHeight: 1.7, marginBottom: 36 }}>School2Pay is designed for UK schools of all sizes — from a single primary to a large multi-academy trust. Get in touch and we&apos;ll have you set up quickly.</p>
          <div className="ctas" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:hello@school2pay.com" className="btn-navy">Email hello@school2pay.com</a>
            <Link href="/login" style={{ background: "transparent", color: "#1C3D6B", fontSize: "0.95rem", fontWeight: 500, padding: "14px 28px", borderRadius: 10, textDecoration: "none", border: "1px solid #DDE8F2", display: "inline-block" }}>School login</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#0F2240", padding: "40px clamp(16px,5vw,48px)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="footer-brand" style={{ fontFamily: "'Outfit',sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
            School<span className="two">2</span>Pay
          </div>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", marginTop: 4 }}>© {new Date().getFullYear()} School2Pay · school2pay.com · Built for UK schools</div>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[["Privacy policy", "/privacy"], ["Terms", "/terms"], ["Safeguarding", "/safeguarding"], ["School login", "/login"]].map(([label, href]) => (
            <Link key={label} href={href} style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>{label}</Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
