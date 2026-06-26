"use client";

import { useEffect, useState } from "react";

interface Template {
  id: string;
  title: string;
  description: string;
  amountPounds: string;
}

const STORAGE_KEY = "s2p_request_templates";

function loadTemplates(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function TemplateLoader() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  if (templates.length === 0) return null;

  function apply(templateId: string) {
    const t = templates.find((t) => t.id === templateId);
    if (!t) return;

    const titleEl = document.querySelector<HTMLInputElement>('[name="title"]');
    const descEl = document.querySelector<HTMLTextAreaElement>('[name="description"]');
    const amountEl = document.querySelector<HTMLInputElement>('[name="_amount_display"]');
    const amountHiddenEl = document.getElementById("amount_pence_hidden") as HTMLInputElement | null;

    if (titleEl) { titleEl.value = t.title; titleEl.dispatchEvent(new Event("input", { bubbles: true })); }
    if (descEl) { descEl.value = t.description; descEl.dispatchEvent(new Event("input", { bubbles: true })); }
    if (amountEl) {
      amountEl.value = t.amountPounds;
      amountEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (amountHiddenEl) {
      const pence = Math.round(parseFloat(t.amountPounds) * 100);
      if (!isNaN(pence)) amountHiddenEl.value = String(pence);
    }

    setSelected(templateId);
  }

  return (
    <div className="mb-4 flex items-center gap-2">
      <label className="text-sm font-medium text-gray-600 shrink-0">Load template:</label>
      <select
        value={selected}
        onChange={(e) => apply(e.target.value)}
        className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <option value="">— choose —</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.title} (£{t.amountPounds})</option>
        ))}
      </select>
    </div>
  );
}

export { STORAGE_KEY };
export type { Template };
