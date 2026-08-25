"use client";

import { useState, useMemo } from "react";
import FeeCalculator from "./FeeCalculator";

interface Student {
  id: string;
  first_name: string;
  year_group: string;
}

interface Props {
  totalStudents: number;
  yearGroups: string[];
  yearGroupCounts: Record<string, number>;
  classes: string[];
  classCounts: Record<string, number>;
  students: Student[];
}

export default function TargetAndFees({ totalStudents, yearGroups, yearGroupCounts, classes, classCounts, students }: Props) {
  const [mode, setMode] = useState<"all" | "year" | "class" | "specific">("all");
  const [selectedYear, setSelectedYear] = useState(yearGroups[0] ?? "");
  const [selectedClass, setSelectedClass] = useState(classes[0] ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(
      (s) => !q || s.first_name.toLowerCase().includes(q) || s.year_group.toLowerCase().includes(q)
    );
  }, [students, search]);

  const studentCount =
    mode === "all" ? totalStudents :
    mode === "year" ? (yearGroupCounts[selectedYear] ?? 0) :
    mode === "class" ? (classCounts[selectedClass] ?? 0) :
    selectedIds.size;

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
    }
  }

  return (
    <div className="space-y-4">
      {/* Hidden fields for the form */}
      <input type="hidden" name="target_mode" value={mode} />
      {mode === "all" && <input type="hidden" name="target" value="all" />}
      {mode === "year" && <input type="hidden" name="target" value={selectedYear} />}
      {mode === "class" && <input type="hidden" name="target_class" value={selectedClass} />}
      {mode === "specific" &&
        [...selectedIds].map((id) => (
          <input key={id} type="hidden" name="student_ids" value={id} />
        ))
      }

      {/* Mode selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Who is this for?</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: `Whole school (${totalStudents})` },
            { value: "year", label: "Year group" },
            ...(classes.length > 0 ? [{ value: "class", label: "Class" }] : []),
            { value: "specific", label: "Specific students" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value as "all" | "year" | "specific")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
                mode === opt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Class picker */}
      {mode === "class" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map((c) => (
              <option key={c} value={c}>
                {c} ({classCounts[c] ?? 0} students)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Year group picker */}
      {mode === "year" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select year group</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearGroups.map((yg) => (
              <option key={yg} value={yg}>
                {yg} ({yearGroupCounts[yg] ?? 0} students)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Specific student picker */}
      {mode === "specific" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Select students
              {selectedIds.size > 0 && (
                <span className="ml-2 text-blue-600 font-normal">{selectedIds.size} selected</span>
              )}
            </label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:underline"
            >
              {selectedIds.size === filteredStudents.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <input
            type="text"
            placeholder="Search by name or year..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {filteredStudents.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No students found</p>
            ) : (
              filteredStudents.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-800">{s.first_name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{s.year_group}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* Amount + fee panel */}
      <FeeCalculator studentCount={studentCount} />
    </div>
  );
}
