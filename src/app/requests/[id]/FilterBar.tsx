"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "waived", label: "Waived" },
];

export default function FilterBar({
  yearGroups,
  totalUnpaid,
}: {
  yearGroups: string[];
  totalUnpaid: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.delete("page"); // reset to page 1 on filter change
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [router, pathname, searchParams]
  );

  const current = {
    status: searchParams.get("status") ?? "",
    q: searchParams.get("q") ?? "",
    year: searchParams.get("year") ?? "",
  };

  return (
    <div className={`flex flex-wrap gap-3 items-center ${isPending ? "opacity-60" : ""}`}>
      {/* Status quick-filter */}
      <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-sm">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => push({ status: opt.value })}
            className={`px-3 py-1.5 font-medium transition-colors ${
              current.status === opt.value
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {opt.label}
            {opt.value === "unpaid" && totalUnpaid > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                current.status === "unpaid" ? "bg-blue-500 text-white" : "bg-amber-100 text-amber-700"
              }`}>
                {totalUnpaid}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Year group dropdown */}
      {yearGroups.length > 1 && (
        <select
          value={current.year}
          onChange={(e) => push({ year: e.target.value })}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All year groups</option>
          {yearGroups.map((yg) => (
            <option key={yg} value={yg}>{yg}</option>
          ))}
        </select>
      )}

      {/* Name search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;
          push({ q });
        }}
        className="flex gap-2"
      >
        <input
          name="q"
          defaultValue={current.q}
          placeholder="Search student name…"
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        {current.q && (
          <button
            type="button"
            onClick={() => push({ q: "" })}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            ✕
          </button>
        )}
      </form>

      {/* Active filter chips */}
      {(current.q || current.year) && (
        <button
          type="button"
          onClick={() => push({ q: "", year: "", status: "" })}
          className="text-xs text-gray-400 hover:text-gray-700 underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
