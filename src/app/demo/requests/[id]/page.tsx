import { notFound } from "next/navigation";
import Link from "next/link";
import DemoNav from "../../DemoNav";
import { getRequest, getStudent, formatPence, CONSENT_RESPONSES } from "../../data";
import DemoConsentModal from "./DemoConsentModal";

const CONSENT_FIELDS = [
  { key: "consent_to_attend",       label: "I consent for my child to attend" },
  { key: "emergency_contact_name",  label: "Emergency contact name" },
  { key: "emergency_contact_phone", label: "Emergency contact phone" },
  { key: "medical_conditions",      label: "Medical conditions / allergies" },
  { key: "dietary_requirements",    label: "Dietary requirements" },
];

export default async function DemoRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = getRequest(id);
  if (!req) notFound();

  const totalDue = req.assignments.reduce((s, a) => s + a.amountDuePence, 0);
  const totalPaid = req.assignments.reduce((s, a) => s + a.amountPaidPence, 0);
  const paidCount = req.assignments.filter((a) => a.status === "paid").length;
  const unpaidCount = req.assignments.filter((a) => a.status === "unpaid").length;
  const pct = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  const consentedCount = req.hasConsent
    ? req.assignments.filter((a) => a.consentStatus === "consented").length
    : 0;
  const pendingConsentCount = req.hasConsent
    ? req.assignments.filter((a) => a.consentStatus === "pending").length
    : 0;

  const dueFormatted = new Date(req.dueDate).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <DemoNav active="requests" />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Back + title */}
        <div>
          <Link href="/demo/requests" className="text-sm text-gray-400 hover:text-gray-600">← Back to requests</Link>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{req.title}</h1>
              <p className="mt-0.5 text-sm text-gray-500">Oakwood Primary · Due {dueFormatted}</p>
              {req.description && <p className="mt-1 text-sm text-gray-600">{req.description}</p>}
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${
              req.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}>
              {req.status}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expected (gross)</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{formatPence(totalDue)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{req.assignments.length} students</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Collected (gross)</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{formatPence(totalPaid)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{paidCount} / {req.assignments.length} paid</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding (gross)</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{formatPence(totalDue - totalPaid)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{unpaidCount} still unpaid</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">% Paid</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{pct}%</p>
            <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-green-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Consent summary */}
        {req.hasConsent && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Consent form attached</p>
              <p className="text-xs text-amber-700 mt-0.5">One-off trip consent · Required before payment</p>
            </div>
            <div className="flex gap-6">
              <div><p className="text-lg font-bold text-green-700">{consentedCount}</p><p className="text-xs text-gray-500">Consented</p></div>
              <div><p className="text-lg font-bold text-amber-700">{pendingConsentCount}</p><p className="text-xs text-gray-500">Pending</p></div>
            </div>
          </div>
        )}

        {/* Student table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Students</h2>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-400 cursor-not-allowed">
              ↓ Export CSV (demo)
            </span>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Year</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  {req.hasConsent && <th className="px-4 py-3 text-left">Consent</th>}
                  <th className="px-4 py-3 text-left">Guardian</th>
                  <th className="px-4 py-3 text-left">Last email</th>
                </tr>
              </thead>
              <tbody>
                {req.assignments.map((asgn) => {
                  const student = getStudent(asgn.studentId);
                  if (!student) return null;
                  const consentKey = `${req.id}-${student.id}`;
                  const consentResponse = CONSENT_RESPONSES[consentKey] ?? null;

                  return (
                    <tr key={asgn.studentId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{student.firstName}</td>
                      <td className="px-4 py-3 text-gray-500">{student.yearGroup}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{formatPence(asgn.amountDuePence)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {asgn.amountPaidPence > 0
                          ? formatPence(asgn.amountPaidPence)
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          asgn.status === "paid"    ? "bg-green-100 text-green-700" :
                          asgn.status === "partial" ? "bg-blue-100 text-blue-700" :
                          asgn.status === "waived"  ? "bg-gray-100 text-gray-500" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {asgn.status}
                        </span>
                        {asgn.auditNote && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{asgn.auditNote}</p>
                        )}
                      </td>
                      {req.hasConsent && (
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-col gap-1">
                            {asgn.consentStatus === "consented" && <span className="text-green-700 font-medium">✓ Consented</span>}
                            {asgn.consentStatus === "pending" && <span className="text-amber-600">Pending</span>}
                            {asgn.consentStatus === "withdrawn" && <span className="text-red-500">Withdrawn</span>}
                            {asgn.consentStatus === "consented" && consentResponse && (
                              <DemoConsentModal
                                studentName={student.firstName}
                                fields={CONSENT_FIELDS}
                                response={consentResponse}
                              />
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-gray-500">{student.guardianEmail}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {asgn.lastEmailSent
                          ? new Date(asgn.lastEmailSent).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : <span className="text-gray-300">Not sent</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Parent pay link demo */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-blue-900">Try the parent payment page</p>
          <p className="text-xs text-blue-700">
            This is what parents see when they click their email link. Use test card{" "}
            <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">4242 4242 4242 4242</code>{" "}
            with any future date and any CVC.
          </p>
          <Link
            href="/demo/pay"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Open parent pay page →
          </Link>
        </div>
      </div>
    </main>
  );
}
