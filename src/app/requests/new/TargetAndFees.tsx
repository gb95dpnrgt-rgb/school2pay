"use client";

import { useState } from "react";
import FeeCalculator from "./FeeCalculator";

interface Props {
  totalStudents: number;
  yearGroups: string[];
  yearGroupCounts: Record<string, number>;
}

export default function TargetAndFees({ totalStudents, yearGroups, yearGroupCounts }: Props) {
  const [target, setTarget] = useState("all");

  const studentCount = target === "all" ? totalStudents : (yearGroupCounts[target] ?? 0);

  return (
    <div className="space-y-4">
      {/* Target selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
        <select
          name="target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Whole school ({totalStudents} students)</option>
          {yearGroups.map((yg) => (
            <option key={yg} value={yg}>
              {yg} only ({yearGroupCounts[yg] ?? 0} students)
            </option>
          ))}
        </select>
      </div>

      {/* Amount + fee panel */}
      <FeeCalculator studentCount={studentCount} />
    </div>
  );
}
