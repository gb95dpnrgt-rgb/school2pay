"use client";

import { useState } from "react";

const STORAGE_KEY = "s2p_request_templates";

interface Template {
  id: string;
  title: string;
  description: string;
  amountPounds: string;
}

function loadTemplates(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function SaveTemplateButton({
  title,
  description,
  amountPence,
}: {
  title: string;
  description: string | null;
  amountPence: number;
}) {
  const [saved, setSaved] = useState(false);

  function save() {
    const templates = loadTemplates().filter((t) => t.title !== title); // replace if same name
    const newTemplate: Template = {
      id: crypto.randomUUID(),
      title,
      description: description ?? "",
      amountPounds: (amountPence / 100).toFixed(2),
    };
    templates.unshift(newTemplate);
    // Keep latest 10 templates only
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, 10)));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <button
      onClick={save}
      className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
    >
      {saved ? "Saved as template ✓" : "Save as template"}
    </button>
  );
}
