"use client";

import { useState } from "react";

type RequestType = "voluntary" | "chargeable" | "residential";

const TYPES: { value: RequestType; label: string; description: string; badge: string; badgeColor: string }[] = [
  {
    value: "voluntary",
    label: "Voluntary contribution",
    description: "Parents are asked but not required to pay. No child may be excluded if a parent does not contribute.",
    badge: "Optional",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    value: "chargeable",
    label: "Chargeable activity",
    description: "An optional extra or board & lodging charge parents can be required to pay. Must not exceed actual cost.",
    badge: "Chargeable",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    value: "residential",
    label: "Residential trip",
    description: "Overnight trip with board & lodging. Remissions must be available for eligible pupils.",
    badge: "Residential",
    badgeColor: "bg-purple-100 text-purple-700",
  },
];

export default function RequestTypeSelector() {
  const [selected, setSelected] = useState<RequestType>("voluntary");

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Request type</label>

      <div className="space-y-2">
        {TYPES.map((t) => (
          <label
            key={t.value}
            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              selected === t.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="request_type"
              value={t.value}
              checked={selected === t.value}
              onChange={() => setSelected(t.value)}
              className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{t.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.badgeColor}`}>
                  {t.badge}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Compliance notice per type */}
      {selected === "voluntary" && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Voluntary contribution rules (Education Act 1996 s.457)</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>The request must make clear that payment is voluntary</li>
            <li>No child may be excluded from the activity for non-payment</li>
            <li>Non-paying families must not be identified to trip leaders</li>
          </ul>
        </div>
      )}
      {selected === "chargeable" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Chargeable activity rules (Education Act 1996 s.455)</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Charges must not exceed the actual cost of providing the activity</li>
            <li>Charges must be set out in the school's Charging & Remissions Policy</li>
            <li>Remissions must be available — use the remissions field below</li>
          </ul>
        </div>
      )}
      {selected === "residential" && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-xs text-purple-800 space-y-1">
          <p className="font-semibold">Residential trip rules (Education Act 1996 s.458)</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Board & lodging charges are permitted; tuition during the trip is not chargeable</li>
            <li>Full remissions must be available for pupils whose parents receive qualifying benefits</li>
            <li>Set a viability threshold — if minimum funds are not met, bulk refund is one click</li>
          </ul>
        </div>
      )}
    </div>
  );
}
