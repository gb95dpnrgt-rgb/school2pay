"use client";

import { useState } from "react";
import ConsentFormBuilder, { type ConsentFieldDraft } from "./ConsentFormBuilder";

export default function ConsentToggle() {
  const [enabled, setEnabled] = useState(false);
  const [fields, setFields] = useState<ConsentFieldDraft[]>([]);
  const [meta, setMeta] = useState({ type: "one_off", requiresConsentBeforePayment: false });

  function handleChange(f: ConsentFieldDraft[], m: { type: string; requiresConsentBeforePayment: boolean }) {
    setFields(f);
    setMeta(m);
  }

  const enabledFields = fields.filter((f) => f.enabled);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <input
          id="attach_consent"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <label htmlFor="attach_consent" className="block text-sm font-medium text-gray-700 cursor-pointer">
            Attach a consent form
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            Parents complete consent alongside payment on the same page.
          </p>
        </div>
      </div>

      {enabled && (
        <>
          <ConsentFormBuilder onChange={handleChange} />

          {/* Hidden fields passed to server action */}
          <input type="hidden" name="consent_enabled" value="on" />
          <input type="hidden" name="consent_type" value={meta.type} />
          <input type="hidden" name="consent_requires_before_payment" value={meta.requiresConsentBeforePayment ? "on" : "off"} />
          <input type="hidden" name="consent_fields" value={JSON.stringify(enabledFields)} />
        </>
      )}
    </div>
  );
}
