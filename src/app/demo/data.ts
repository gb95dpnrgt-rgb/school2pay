// ── Demo seed data — static, no DB needed ────────────────────────────────

export const SCHOOL = { name: "Oakwood Primary School", urn: "123456" };

export const STUDENTS = [
  { id: "s1",  firstName: "Emma",    yearGroup: "Year 1", guardianEmail: "emma.parent@example.com",   guardianPhone: "07700900001" },
  { id: "s2",  firstName: "Jack",    yearGroup: "Year 1", guardianEmail: "jack.parent@example.com",   guardianPhone: "07700900002" },
  { id: "s3",  firstName: "Sophie",  yearGroup: "Year 2", guardianEmail: "sophie.parent@example.com", guardianPhone: "07700900003" },
  { id: "s4",  firstName: "Oliver",  yearGroup: "Year 2", guardianEmail: "oliver.parent@example.com", guardianPhone: "07700900004" },
  { id: "s5",  firstName: "Amelia",  yearGroup: "Year 3", guardianEmail: "amelia.parent@example.com", guardianPhone: "07700900005" },
  { id: "s6",  firstName: "Harry",   yearGroup: "Year 3", guardianEmail: "harry.parent@example.com",  guardianPhone: "" },
  { id: "s7",  firstName: "Isla",    yearGroup: "Year 4", guardianEmail: "isla.parent@example.com",   guardianPhone: "07700900006" },
  { id: "s8",  firstName: "Charlie", yearGroup: "Year 4", guardianEmail: "charlie.parent@example.com",guardianPhone: "07700900007" },
  { id: "s9",  firstName: "Grace",   yearGroup: "Year 5", guardianEmail: "grace.parent@example.com",  guardianPhone: "07700900008" },
  { id: "s10", firstName: "Noah",    yearGroup: "Year 5", guardianEmail: "noah.parent@example.com",   guardianPhone: "" },
  { id: "s11", firstName: "Liam",    yearGroup: "Year 6", guardianEmail: "liam.parent@example.com",   guardianPhone: "07700900011" },
  { id: "s12", firstName: "Mia",     yearGroup: "Year 6", guardianEmail: "mia.parent@example.com",    guardianPhone: "07700900012" },
];

export type PaymentStatus = "paid" | "unpaid" | "partial" | "waived";
export type ConsentStatus = "consented" | "pending" | "withdrawn";

export type Assignment = {
  studentId: string;
  amountDuePence: number;
  amountPaidPence: number;
  status: PaymentStatus;
  consentStatus: ConsentStatus | null;
  lastEmailSent: string | null;
  auditNote: string | null;
};

export type PaymentRequest = {
  id: string;
  title: string;
  description: string;
  amountPence: number;
  dueDate: string;
  status: "open" | "closed";
  hasConsent: boolean;
  assignments: Assignment[];
};

export const PAYMENT_REQUESTS: PaymentRequest[] = [
  {
    id: "pr1",
    title: "Year 5 & 6 Theatre Trip",
    description: "Visit to the Lyric Theatre to see A Midsummer Night's Dream",
    amountPence: 2500,
    dueDate: "2026-09-15",
    status: "open",
    hasConsent: true,
    assignments: [
      { studentId: "s9",  amountDuePence: 2500, amountPaidPence: 2500, status: "paid",   consentStatus: "consented", lastEmailSent: "2026-07-01", auditNote: null },
      { studentId: "s10", amountDuePence: 2500, amountPaidPence: 0,    status: "unpaid", consentStatus: "pending",   lastEmailSent: "2026-07-01", auditNote: null },
      { studentId: "s11", amountDuePence: 2500, amountPaidPence: 2500, status: "paid",   consentStatus: "consented", lastEmailSent: "2026-07-01", auditNote: null },
      { studentId: "s12", amountDuePence: 2500, amountPaidPence: 0,    status: "unpaid", consentStatus: "pending",   lastEmailSent: "2026-07-02", auditNote: null },
    ],
  },
  {
    id: "pr2",
    title: "After-School Football Club — Autumn Term",
    description: "10-week programme, Tuesdays 3:30–4:30pm",
    amountPence: 4000,
    dueDate: "2026-08-31",
    status: "open",
    hasConsent: false,
    assignments: [
      { studentId: "s5",  amountDuePence: 4000, amountPaidPence: 4000, status: "paid",   consentStatus: null, lastEmailSent: "2026-06-20", auditNote: null },
      { studentId: "s6",  amountDuePence: 4000, amountPaidPence: 0,    status: "waived", consentStatus: null, lastEmailSent: "2026-06-20", auditNote: "Free school meals — waived" },
      { studentId: "s7",  amountDuePence: 4000, amountPaidPence: 2000, status: "partial",consentStatus: null, lastEmailSent: "2026-06-25", auditNote: null },
      { studentId: "s8",  amountDuePence: 4000, amountPaidPence: 4000, status: "paid",   consentStatus: null, lastEmailSent: "2026-06-20", auditNote: null },
    ],
  },
  {
    id: "pr3",
    title: "Year 3 & 4 Residential — Kingswood",
    description: "3-night outdoor education residential, 14–17 October",
    amountPence: 19500,
    dueDate: "2026-10-01",
    status: "open",
    hasConsent: true,
    assignments: [
      { studentId: "s5",  amountDuePence: 19500, amountPaidPence: 19500, status: "paid",   consentStatus: "consented", lastEmailSent: "2026-06-15", auditNote: null },
      { studentId: "s6",  amountDuePence: 19500, amountPaidPence: 0,     status: "unpaid", consentStatus: "pending",   lastEmailSent: "2026-06-15", auditNote: null },
      { studentId: "s7",  amountDuePence: 19500, amountPaidPence: 9750,  status: "partial",consentStatus: "consented", lastEmailSent: "2026-06-15", auditNote: null },
      { studentId: "s8",  amountDuePence: 19500, amountPaidPence: 0,     status: "unpaid", consentStatus: "pending",   lastEmailSent: "2026-06-30", auditNote: null },
    ],
  },
  {
    id: "pr4",
    title: "School Dinner Money — Summer Term",
    description: "6-week block payment",
    amountPence: 13200,
    dueDate: "2026-07-18",
    status: "closed",
    hasConsent: false,
    assignments: [
      { studentId: "s1",  amountDuePence: 13200, amountPaidPence: 13200, status: "paid", consentStatus: null, lastEmailSent: "2026-04-10", auditNote: null },
      { studentId: "s2",  amountDuePence: 13200, amountPaidPence: 13200, status: "paid", consentStatus: null, lastEmailSent: "2026-04-10", auditNote: null },
      { studentId: "s3",  amountDuePence: 13200, amountPaidPence: 13200, status: "paid", consentStatus: null, lastEmailSent: "2026-04-10", auditNote: null },
    ],
  },
];

export function getRequest(id: string) {
  return PAYMENT_REQUESTS.find((r) => r.id === id) ?? null;
}

export function getStudent(id: string) {
  return STUDENTS.find((s) => s.id === id) ?? null;
}

export function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

// Fake consent responses for the demo
export const CONSENT_RESPONSES: Record<string, {
  guardianNameSigned: string;
  signedAt: string;
  responses: Record<string, string>;
}> = {
  "pr1-s9": {
    guardianNameSigned: "Sarah Johnson",
    signedAt: "2026-07-01T10:23:00Z",
    responses: {
      consent_to_attend: "Yes",
      emergency_contact_name: "David Johnson",
      emergency_contact_phone: "07700900099",
      medical_conditions: "None",
      dietary_requirements: "Vegetarian",
    },
  },
  "pr1-s11": {
    guardianNameSigned: "Mark Williams",
    signedAt: "2026-07-02T14:05:00Z",
    responses: {
      consent_to_attend: "Yes",
      emergency_contact_name: "Claire Williams",
      emergency_contact_phone: "07700900088",
      medical_conditions: "Mild asthma — inhaler carried by child",
      dietary_requirements: "None",
    },
  },
};
