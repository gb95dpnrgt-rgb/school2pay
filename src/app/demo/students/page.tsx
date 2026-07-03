import DemoNav from "../DemoNav";
import { STUDENTS } from "../data";

export default function DemoStudents() {
  const yearGroups = [...new Set(STUDENTS.map((s) => s.yearGroup))].sort();

  return (
    <main className="min-h-screen bg-gray-50">
      <DemoNav active="students" />

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Students</h1>
            <p className="text-sm text-gray-500 mt-0.5">{STUDENTS.length} students across {yearGroups.length} year groups</p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-xs text-gray-400">
            ↑ Import CSV (demo)
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">First name</th>
                <th className="px-4 py-3 text-left">Year group</th>
                <th className="px-4 py-3 text-left">Guardian email</th>
                <th className="px-4 py-3 text-left">Guardian phone</th>
              </tr>
            </thead>
            <tbody>
              {STUDENTS.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.firstName}</td>
                  <td className="px-4 py-3 text-gray-500">{s.yearGroup}</td>
                  <td className="px-4 py-3 text-gray-500">{s.guardianEmail}</td>
                  <td className="px-4 py-3 text-gray-400">{s.guardianPhone || <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
