"use client";

import { useState } from "react";

export type ConsentFieldDraft = {
  key: string;
  label: string;
  field_type: "yes_no" | "text" | "activity_checklist";
  required: boolean;
  sort_order: number;
  enabled: boolean;
};

const TEMPLATE_FIELDS: ConsentFieldDraft[] = [
  { key: "consent_to_attend",        label: "I consent for my child to attend this activity", field_type: "yes_no",               required: true,  sort_order: 0,  enabled: true  },
  { key: "emergency_contact_name",   label: "Emergency contact name",                          field_type: "text",                 required: true,  sort_order: 1,  enabled: true  },
  { key: "emergency_contact_phone",  label: "Emergency contact phone number",                  field_type: "text",                 required: true,  sort_order: 2,  enabled: true  },
  { key: "medical_conditions",       label: "Medical conditions / allergies (or write 'None')", field_type: "text",               required: true,  sort_order: 3,  enabled: true  },
  { key: "dietary_requirements",     label: "Dietary requirements (or write 'None')",           field_type: "text",               required: false, sort_order: 4,  enabled: true  },
  { key: "medication_consent",       label: "My child requires medication to be administered", field_type: "yes_no",               required: false, sort_order: 5,  enabled: false },
  { key: "medication_detail",        label: "Medication details (name, dose, timing)",          field_type: "text",               required: false, sort_order: 6,  enabled: false },
  { key: "gp_details",               label: "GP name and surgery (optional)",                   field_type: "text",               required: false, sort_order: 7,  enabled: false },
  { key: "photo_consent",            label: "I consent to photos/videos for school use",       field_type: "yes_no",               required: false, sort_order: 8,  enabled: false },
  { key: "adventurous_activity",     label: "Adventurous activities consent",                  field_type: "activity_checklist",   required: false, sort_order: 9,  enabled: false },
  { key: "transport_consent",        label: "I consent to transport / walking arrangements",   field_type: "yes_no",               required: false, sort_order: 10, enabled: false },
];

interface Props {
  onChange: (fields: ConsentFieldDraft[], meta: { type: string; requiresConsentBeforePayment: boolean }) => void;
}

export default function ConsentFormBuilder({ onChange }: Props) {
  const [fields, setFields] = useState<ConsentFieldDraft[]>(TEMPLATE_FIELDS);
  const [formType, setFormType] = useState<"one_off" | "routine_blanket">("one_off");
  const [requiresBefore, setRequiresBefore] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customType, setCustomType] = useState<"yes_no" | "text">("yes_no");

  function notify(f: ConsentFieldDraft[]) {
    onChange(f, { type: formType, requiresConsentBeforePayment: requiresBefore });
  }

  function toggle(key: string) {
    const next = fields.map((f) => f.key === key ? { ...f, enabled: !f.enabled } : f);
    setFields(next);
    notify(next);
  }

  function addCustom() {
    if (!customLabel.trim()) return;
    const next = [
      ...fields,
      {
        key: `custom_${Date.now()}`,
        label: customLabel.trim(),
        field_type: customType,
        required: false,
        sort_order: fields.length,
        enabled: true,
      },
    ];
    setFields(next);
    setCustomLabel("");
    notify(next);
  }

  const enabledCount = fields.filter((f) => f.enabled).length;

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div>
        <p className="text-sm font-semibold text-blue-900 mb-1">Consent form type</p>
        <div className="flex gap-3">
          {(["one_off", "routine_blanket"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-blue-800">
              <input
                type="radio"
                name="consent_type"
                value={t}
                checked={formType === t}
                onChange={() => { setFormType(t); onChange(fields, { type: t, requiresConsentBeforePayment: requiresBefore }); }}
                className="accent-blue-600"
              />
              {t === "one_off" ? "One-off (this trip only)" : "Routine blanket (annual)"}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-800">
        <input
          type="checkbox"
          checked={requiresBefore}
          onChange={(e) => { setRequiresBefore(e.target.checked); onChange(fields, { type: formType, requiresConsentBeforePayment: e.target.checked }); }}
          className="accent-blue-600"
        />
        Require consent before parent can pay
      </label>

      <div>
        <p className="text-sm font-semibold text-blue-900 mb-2">Fields ({enabledCount} selected)</p>
        <div className="space-y-1">
          {fields.map((f) => (
            <label key={f.key} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-blue-100 cursor-pointer">
              <input
                type="checkbox"
                checked={f.enabled}
                onChange={() => toggle(f.key)}
                className="accent-blue-600 flex-shrink-0"
              />
              <span className="text-sm text-blue-900 flex-1">{f.label}</span>
              <span className="text-xs text-blue-500 flex-shrink-0">
                {f.field_type === "yes_no" ? "Yes/No" : f.field_type === "activity_checklist" ? "Checklist" : "Text"}
                {f.required && " · required"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Add custom field */}
      <div className="border-t border-blue-200 pt-3 space-y-2">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Add custom field</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Field label…"
            className="flex-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={customType}
            onChange={(e) => setCustomType(e.target.value as "yes_no" | "text")}
            className="rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="yes_no">Yes/No</option>
            <option value="text">Text</option>
          </select>
          <button
            type="button"
            onClick={addCustom}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
