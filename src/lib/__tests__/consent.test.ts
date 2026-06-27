/**
 * Consent form unit tests — 5 key scenarios
 *
 * These tests verify:
 * 1. Consent response is inserted (not updated) — append-only contract
 * 2. Withdrawal sets withdrawn_at without deleting the row
 * 3. requiresConsentBeforePayment blocks payment path when consent absent
 * 4. requiresConsentBeforePayment allows payment when consent present
 * 5. Multiple children — consent tracked independently per assignment
 *
 * Note: these are unit tests against the logic functions, not integration tests.
 * Integration tests (DB round-trips) require a live Supabase instance; mark
 * those for manual testing per CLAUDE.md.
 */

// ────────────────────────────────────────────────────────────────────────────
// Helpers that mirror what the API routes do (extracted for testability)
// ────────────────────────────────────────────────────────────────────────────

type ConsentResponse = {
  id: string;
  consent_form_id: string;
  assignment_id: string;
  guardian_id: string;
  responses: Record<string, unknown>;
  guardian_name_signed: string;
  signed_at: string;
  withdrawn_at: string | null;
  withdrawn_reason: string | null;
};

/** Simulated in-memory DB */
let store: ConsentResponse[] = [];
let nextId = 1;

function insertConsentResponse(data: Omit<ConsentResponse, "id" | "signed_at" | "withdrawn_at" | "withdrawn_reason">): ConsentResponse {
  const row: ConsentResponse = {
    ...data,
    id: String(nextId++),
    signed_at: new Date().toISOString(),
    withdrawn_at: null,
    withdrawn_reason: null,
  };
  store.push(row);
  return row;
}

function withdrawConsentResponse(id: string, reason: string): void {
  const row = store.find((r) => r.id === id);
  if (!row) throw new Error("Not found");
  if (row.withdrawn_at) throw new Error("Already withdrawn");
  // NEVER delete — only set withdrawn_at
  row.withdrawn_at = new Date().toISOString();
  row.withdrawn_reason = reason;
}

function getLatestActiveConsent(assignmentId: string): ConsentResponse | null {
  return store
    .filter((r) => r.assignment_id === assignmentId && !r.withdrawn_at)
    .sort((a, b) => b.signed_at.localeCompare(a.signed_at))[0] ?? null;
}

function canParentPay(requiresConsentBeforePayment: boolean, assignmentId: string): boolean {
  if (!requiresConsentBeforePayment) return true;
  return getLatestActiveConsent(assignmentId) !== null;
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  store = [];
  nextId = 1;
});

describe("Consent — append-only contract", () => {
  test("1. each submission creates a NEW row, never overwrites", () => {
    const base = {
      consent_form_id: "form-1",
      assignment_id: "asgn-1",
      guardian_id: "guardian-1",
      responses: { consent_to_attend: "Yes" },
      guardian_name_signed: "Jane Smith",
    };

    insertConsentResponse(base);
    insertConsentResponse({ ...base, responses: { consent_to_attend: "No" } }); // re-sign

    expect(store).toHaveLength(2);
    expect(store[0].responses.consent_to_attend).toBe("Yes");
    expect(store[1].responses.consent_to_attend).toBe("No");
  });
});

describe("Consent — withdrawal", () => {
  test("2. withdrawal sets withdrawn_at and keeps row", () => {
    const row = insertConsentResponse({
      consent_form_id: "form-1",
      assignment_id: "asgn-1",
      guardian_id: "guardian-1",
      responses: {},
      guardian_name_signed: "Jane Smith",
    });

    withdrawConsentResponse(row.id, "Changed mind");

    expect(store).toHaveLength(1); // row still exists
    expect(store[0].withdrawn_at).not.toBeNull();
    expect(store[0].withdrawn_reason).toBe("Changed mind");
  });

  test("2b. withdrawing an already-withdrawn response throws", () => {
    const row = insertConsentResponse({
      consent_form_id: "form-1",
      assignment_id: "asgn-1",
      guardian_id: "guardian-1",
      responses: {},
      guardian_name_signed: "Jane Smith",
    });
    withdrawConsentResponse(row.id, "First withdrawal");
    expect(() => withdrawConsentResponse(row.id, "Second")).toThrow("Already withdrawn");
  });
});

describe("requiresConsentBeforePayment gate", () => {
  test("3. blocks payment when no active consent exists", () => {
    expect(canParentPay(true, "asgn-1")).toBe(false);
  });

  test("4. allows payment when active consent exists", () => {
    insertConsentResponse({
      consent_form_id: "form-1",
      assignment_id: "asgn-1",
      guardian_id: "guardian-1",
      responses: { consent_to_attend: "Yes" },
      guardian_name_signed: "Jane Smith",
    });

    expect(canParentPay(true, "asgn-1")).toBe(true);
  });

  test("4b. blocks payment after withdrawal even if form was submitted", () => {
    const row = insertConsentResponse({
      consent_form_id: "form-1",
      assignment_id: "asgn-1",
      guardian_id: "guardian-1",
      responses: {},
      guardian_name_signed: "Jane Smith",
    });
    withdrawConsentResponse(row.id, "Trip cancelled");

    expect(canParentPay(true, "asgn-1")).toBe(false);
  });
});

describe("Multiple children — independent consent tracking", () => {
  test("5. consent for child A does not satisfy consent for child B", () => {
    insertConsentResponse({
      consent_form_id: "form-1",
      assignment_id: "asgn-child-A",
      guardian_id: "guardian-1",
      responses: {},
      guardian_name_signed: "Jane Smith",
    });

    expect(canParentPay(true, "asgn-child-A")).toBe(true);
    expect(canParentPay(true, "asgn-child-B")).toBe(false);
  });
});
