"use client";

import { useState, useTransition } from "react";

export type ConsentField = {
  id: string;
  key: string;
  label: string;
  field_type: "yes_no" | "text" | "activity_checklist";
  required: boolean;
  sort_order: number;
};

export type ConsentFormData = {
  consentFormId: string;
  assignmentId: string;
  fields: ConsentField[];
  consentFormType: string;
  studentName: string;
  existingResponse?: {
    id: string;
    responses: Record<string, unknown>;
    guardian_name_signed: string;
    signed_at: string;
    withdrawn_at: string | null;
  } | null;
};

const ACTIVITY_OPTIONS = [
  "High ropes / climbing",
  "Water sports / swimming",
  "Cycling",
  "Hill walking / orienteering",
  "Archery / target sports",
  "Overnight stays",
];

interface Props {
  forms: ConsentFormData[];
  guardianId: string;
  token: string;
  onAllConsented: () => void;
}

export default function ConsentForm({ forms, guardianId, token, onAllConsented }: Props) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(forms.map((f) => [f.assignmentId, {}]))
  );
  const [guardianName, setGuardianName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => forms.map((f) => !!f.existingResponse?.signed_at && !f.existingResponse?.withdrawn_at));

  const current = forms[step];

  if (!current) {
    onAllConsented();
    return null;
  }

  const isAlreadyConsented = !!current.existingResponse?.signed_at && !current.existingResponse?.withdrawn_at;

  function setField(key: string, value: unknown) {
    setResponses((prev) => ({
      ...prev,
      [current.assignmentId]: { ...prev[current.assignmentId], [key]: value },
    }));
  }

  function validate(): string | null {
    for (const f of current.fields) {
      if (!f.required) continue;
      const val = responses[current.assignmentId]?.[f.key];
      if (val === undefined || val === "" || val === null) {
        return `"${f.label}" is required`;
      }
    }
    if (!guardianName.trim()) return "Please enter your name to sign";
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);

    startTransition(async () => {
      try {
        const resp = await fetch("/api/consent/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            guardianId,
            consentFormId: current.consentFormId,
            assignmentId: current.assignmentId,
            responses: responses[current.assignmentId],
            guardianNameSigned: guardianName.trim(),
          }),
        });
        if (!resp.ok) {
          const d = await resp.json();
          setError(d.error ?? "Failed to save consent");
          return;
        }
        const nextDone = [...done];
        nextDone[step] = true;
        setDone(nextDone);
        if (step + 1 < forms.length) {
          setStep(step + 1);
        } else {
          onAllConsented();
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  async function handleWithdraw() {
    if (!current.existingResponse) return;
    startTransition(async () => {
      const resp = await fetch("/api/consent/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          guardianId,
          consentResponseId: current.existingResponse!.id,
          reason: "Withdrawn by parent",
        }),
      });
      if (resp.ok) {
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Progress when multiple children */}
      {forms.length > 1 && (
        <div className="flex gap-2 mb-2">
          {forms.map((f, i) => (
            <button
              key={f.assignmentId}
              type="button"
              onClick={() => setStep(i)}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                done[i] ? "bg-green-500" : i === step ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Consent required</p>
          <p className="text-sm font-medium text-amber-900">
            {current.studentName} — {current.consentFormType === "routine_blanket" ? "Blanket annual consent" : "One-off trip consent"}
          </p>
        </div>

        {isAlreadyConsented ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Consent given by {current.existingResponse!.guardian_name_signed} on{" "}
              {new Date(current.existingResponse!.signed_at).toLocaleDateString("en-GB")}.
            </div>
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={isPending}
              className="text-xs text-red-500 hover:underline"
            >
              Withdraw consent
            </button>
            {step + 1 < forms.length && !done[step + 1] && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Next child →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* GDPR privacy notice for special-category fields */}
            {current.fields.some((f) => ["medical_conditions", "dietary_requirements", "medication_consent", "medication_detail", "gp_details"].includes(f.key)) && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
                <strong>Data notice:</strong> Medical and dietary information is special category data under UK GDPR. It is used only to safeguard your child on this trip and will be deleted 1 year after the trip date. See our{" "}
                <a href="/privacy" className="underline">privacy policy</a>.
              </div>
            )}

            {current.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-sm font-medium text-gray-800">
                  {f.label}
                  {f.required && <span className="ml-1 text-red-500">*</span>}
                </label>

                {f.field_type === "yes_no" && (
                  <div className="flex gap-4">
                    {["Yes", "No"].map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                        <input
                          type="radio"
                          name={`${current.assignmentId}_${f.key}`}
                          value={opt}
                          checked={responses[current.assignmentId]?.[f.key] === opt}
                          onChange={() => setField(f.key, opt)}
                          className="accent-blue-600"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {f.field_type === "text" && (
                  <textarea
                    rows={2}
                    value={(responses[current.assignmentId]?.[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Type here…"
                  />
                )}

                {f.field_type === "activity_checklist" && (
                  <div className="space-y-1">
                    {ACTIVITY_OPTIONS.map((act) => {
                      const current_responses = (responses[current.assignmentId]?.[f.key] as string[]) ?? [];
                      return (
                        <label key={act} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={current_responses.includes(act)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...current_responses, act]
                                : current_responses.filter((a) => a !== act);
                              setField(f.key, updated);
                            }}
                            className="accent-blue-600"
                          />
                          {act}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <div className="border-t border-amber-200 pt-4 space-y-2">
              <p className="text-xs text-gray-500">
                By typing your name below you confirm the information above is correct and you consent to the trip conditions.
              </p>
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Your full name (electronic signature)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving…" : "Submit consent"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
