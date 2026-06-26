// Pure CSV parsing utilities — no Next.js / server APIs, safe to import in both client and server.

export interface ParsedRow {
  line: number;
  student_first_name: string;
  year_group: string;
  parent_email: string;
  parent_phone: string;
  relationship: string;
}

export interface RowError {
  line: number;
  raw: Record<string, string>;
  reason: string;
}

export interface RowDuplicate {
  row: ParsedRow;
  reason: string;
}

export interface ParseResult {
  valid: ParsedRow[];
  duplicates: RowDuplicate[];
  errors: RowError[];
}

// ── Header normalisation ──────────────────────────────────────────────────────

function slug(s: string) {
  return s.toLowerCase().replace(/[\s_\-().]+/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  studentfirstname: "student_first_name",
  studentname: "student_first_name",
  firstname: "student_first_name",
  forename: "student_first_name",
  pupilname: "student_first_name",
  name: "student_first_name",
  yeargroup: "year_group",
  year: "year_group",
  class: "year_group",
  form: "year_group",
  parentemail: "parent_email",
  guardianemail: "parent_email",
  email: "parent_email",
  emailaddress: "parent_email",
  parentphone: "parent_phone",
  guardianphone: "parent_phone",
  phone: "parent_phone",
  telephone: "parent_phone",
  mobile: "parent_phone",
  mobilenumber: "parent_phone",
  relationship: "relationship",
  relation: "relationship",
  guardianrelationship: "relationship",
};

function canonicalHeader(raw: string): string {
  return HEADER_ALIASES[slug(raw)] ?? slug(raw);
}

// ── Low-level CSV row parser ──────────────────────────────────────────────────

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      // trailing empty field after final comma
      if (fields.length > 0) break;
    }
    if (line[i] === '"') {
      let field = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field.trim());
      if (line[i] === ",") i++;
    } else {
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i).trim());
        break;
      }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return fields;
}

// ── Email validation ──────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(e: string) {
  return EMAIL_RE.test(e);
}

// ── Main parse function ───────────────────────────────────────────────────────

export function parseCSV(raw: string): ParseResult {
  // Strip UTF-8 BOM
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;

  // Normalise line endings and split
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Find header row (first non-blank line)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { valid: [], duplicates: [], errors: [] };
  }

  const rawHeaders = parseRow(lines[headerIdx]);
  const headers = rawHeaders.map(canonicalHeader);

  const col = (row: string[], key: string): string => {
    const idx = headers.indexOf(key);
    return idx === -1 ? "" : (row[idx] ?? "").trim();
  };

  const valid: ParsedRow[] = [];
  const duplicates: RowDuplicate[] = [];
  const errors: RowError[] = [];

  // For duplicate detection within the file
  const seenStudentParent = new Set<string>(); // `name|year|email`
  const seenStudentKey = new Map<string, number>(); // `name|year` → first line

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    if (!rawLine.trim()) continue; // skip blank rows

    const cells = parseRow(rawLine);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = cells[idx] ?? ""; });

    const firstName = col(cells, "student_first_name");
    const yearGroup = col(cells, "year_group");
    const email = col(cells, "parent_email").toLowerCase();
    const phone = col(cells, "parent_phone");
    const relationship = col(cells, "relationship") || "parent";

    // Validate required fields
    if (!firstName) {
      errors.push({ line: lineNum, raw, reason: "Missing student first name" });
      continue;
    }
    if (!yearGroup) {
      errors.push({ line: lineNum, raw, reason: "Missing year group" });
      continue;
    }
    if (!email) {
      errors.push({ line: lineNum, raw, reason: "Missing parent email" });
      continue;
    }
    if (!isValidEmail(email)) {
      errors.push({ line: lineNum, raw, reason: `Invalid email address: "${email}"` });
      continue;
    }

    const studentParentKey = `${firstName.toLowerCase()}|${yearGroup.toLowerCase()}|${email}`;
    const studentKey = `${firstName.toLowerCase()}|${yearGroup.toLowerCase()}`;

    if (seenStudentParent.has(studentParentKey)) {
      duplicates.push({
        row: { line: lineNum, student_first_name: firstName, year_group: yearGroup, parent_email: email, parent_phone: phone, relationship },
        reason: `Duplicate row: ${firstName} (${yearGroup}) with ${email} already appears earlier in this file`,
      });
      continue;
    }

    seenStudentParent.add(studentParentKey);
    seenStudentKey.set(studentKey, lineNum);

    valid.push({ line: lineNum, student_first_name: firstName, year_group: yearGroup, parent_email: email, parent_phone: phone, relationship });
  }

  return { valid, duplicates, errors };
}
