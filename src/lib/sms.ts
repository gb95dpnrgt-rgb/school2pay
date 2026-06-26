import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

// Returns null if Twilio is not configured — SMS is opt-in, not required
function getClient() {
  if (!accountSid || !authToken || !fromNumber) return null;
  return twilio(accountSid, authToken);
}

export async function sendSmsReminder({
  to,
  guardianName,
  schoolName,
  requestTitle,
  amountPence,
  payUrl,
}: {
  to: string;
  guardianName?: string;
  schoolName: string;
  requestTitle: string;
  amountPence: number;
  payUrl: string;
}): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  // Normalise UK phone numbers to E.164
  const normalised = normaliseUkPhone(to);
  if (!normalised) {
    console.warn(`[sms] invalid phone number, skipping: ${to}`);
    return false;
  }

  const amount = `£${(amountPence / 100).toFixed(2)}`;
  const body =
    `${schoolName}: Payment reminder for ${requestTitle}. ` +
    `Amount: ${amount}. Pay securely: ${payUrl} ` +
    `(Do not share this link)`;

  try {
    await client.messages.create({ from: fromNumber!, to: normalised, body });
    return true;
  } catch (err) {
    console.error("[sms] Twilio error:", err);
    return false;
  }
}

function normaliseUkPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+44${digits.slice(1)}`;
  if (digits.length === 10) return `+44${digits}`; // assume UK without leading 0
  return null;
}

export function smsEnabled(): boolean {
  return !!(accountSid && authToken && fromNumber);
}
