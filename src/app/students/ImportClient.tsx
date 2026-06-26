"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCSV, type ParseResult, type ParsedRow } from "./parseCSV";
import { saveImport, type ImportResult } from "./actions";

type Stage = "idle" | "preview" | "success";

export default function ImportClient() {
  const [stage, setStage] = useState<Stage>("idle");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text);
      setParseResult(result);
      setStage("preview");
    };
    reader.readAsText(file, "utf-8");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleConfirm() {
    if (!parseResult?.valid.length) return;
    startTransition(async () => {
      try {
        const result = await saveImport(parseResult.valid);
        setImportResult(result);
        setStage("success");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      }
    });
  }

  if (stage === "success" && importResult) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
        <h3 className="font-semibold text-green-800">Import complete</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>{importResult.studentsCreated} student{importResult.studentsCreated !== 1 ? "s" : ""} created{importResult.studentsSkipped > 0 ? `, ${importResult.studentsSkipped} already existed` : ""}</li>
          <li>{importResult.guardiansCreated} guardian{importResult.guardiansCreated !== 1 ? "s" : ""} created</li>
          <li>{importResult.linksCreated} parent–student link{importResult.linksCreated !== 1 ? "s" : ""} created{importResult.linksSkipped > 0 ? `, ${importResult.linksSkipped} skipped` : ""}</li>
        </ul>
        <button onClick={() => { setStage("idle"); setParseResult(null); setImportResult(null); }} className="text-sm text-green-700 underline">
          Import another file
        </button>
      </div>
    );
  }

  if (stage === "preview" && parseResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Import preview</h3>
          <button onClick={() => { setStage("idle"); setParseResult(null); }} className="text-sm text-gray-400 hover:text-gray-600">
            ← Back
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

        {/* Valid rows */}
        <Section
          title={`${parseResult.valid.length} row${parseResult.valid.length !== 1 ? "s" : ""} to import`}
          colour="green"
          defaultOpen
        >
          {parseResult.valid.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Nothing to import.</p>
          ) : (
            <RowTable rows={parseResult.valid} />
          )}
        </Section>

        {/* Duplicates */}
        {parseResult.duplicates.length > 0 && (
          <Section title={`${parseResult.duplicates.length} duplicate${parseResult.duplicates.length !== 1 ? "s" : ""} (will be skipped)`} colour="yellow">
            {parseResult.duplicates.map((d, i) => (
              <div key={i} className="text-sm py-1 border-b last:border-0 border-yellow-100">
                <span className="font-medium">{d.row.student_first_name}</span> {d.row.year_group} · {d.row.parent_email}
                <span className="ml-2 text-yellow-700">— {d.reason}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Errors */}
        {parseResult.errors.length > 0 && (
          <Section title={`${parseResult.errors.length} error${parseResult.errors.length !== 1 ? "s" : ""} (will be skipped)`} colour="red">
            {parseResult.errors.map((e, i) => (
              <div key={i} className="text-sm py-1 border-b last:border-0 border-red-100">
                <span className="text-gray-400 mr-2">Line {e.line}</span>
                <span className="text-red-700">{e.reason}</span>
              </div>
            ))}
          </Section>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleConfirm}
            disabled={isPending || parseResult.valid.length === 0}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? "Importing…" : `Import ${parseResult.valid.length} row${parseResult.valid.length !== 1 ? "s" : ""}`}
          </button>
          <button
            onClick={() => { setStage("idle"); setParseResult(null); }}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Idle — drop zone
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
      onClick={() => fileRef.current?.click()}
    >
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" />
      <p className="text-sm font-medium text-gray-600">Drop a CSV here or click to browse</p>
      <p className="mt-1 text-xs text-gray-400">
        Expected columns: student_first_name, year_group, parent_email, parent_phone, relationship
      </p>
      <a
        href="/sample-students.csv"
        download
        onClick={(e) => e.stopPropagation()}
        className="mt-3 inline-block text-xs text-blue-600 hover:underline"
      >
        Download sample CSV →
      </a>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  title,
  colour,
  children,
  defaultOpen = false,
}: {
  title: string;
  colour: "green" | "yellow" | "red";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colours = {
    green: "bg-green-50 border-green-200 text-green-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    red: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-lg border ${colours[colour]} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-left"
      >
        <span>{title}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function RowTable({ rows }: { rows: ParsedRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs mt-1">
        <thead>
          <tr className="text-left text-gray-500 border-b border-green-100">
            <th className="py-1 pr-3 font-medium">Student</th>
            <th className="py-1 pr-3 font-medium">Year</th>
            <th className="py-1 pr-3 font-medium">Parent email</th>
            <th className="py-1 pr-3 font-medium">Phone</th>
            <th className="py-1 font-medium">Relationship</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.line}`} className="border-b border-green-50 last:border-0">
              <td className="py-1 pr-3">{r.student_first_name}</td>
              <td className="py-1 pr-3">{r.year_group}</td>
              <td className="py-1 pr-3">{r.parent_email}</td>
              <td className="py-1 pr-3">{r.parent_phone || "—"}</td>
              <td className="py-1">{r.relationship}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
