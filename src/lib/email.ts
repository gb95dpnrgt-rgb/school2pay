import { Resend } from "resend";
import { signMagicToken, type MagicLinkPayload } from "./magic-link";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM ?? "School2Pay <payments@school2pay.example.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface GuardianEmailData {
  guardianId: string;
  email: string;
  paymentRequestId: string;
  requestTitle: string;
  schoolName: string;
  dueDate: string;
  isReminder?: boolean;
  children: Array<{
    firstName: string;
    yearGroup: string;
    amountPence: number;
  }>;
}

export async function sendPaymentNotification(data: GuardianEmailData): Promise<string | null> {
  const token = await signMagicToken(data.guardianId, data.paymentRequestId);
  const payUrl = `${APP_URL}/pay/${encodeURIComponent(token)}`;

  const totalPence = data.children.reduce((s, c) => s + c.amountPence, 0);
  const totalStr = `£${(totalPence / 100).toFixed(2)}`;

  const childrenHtml = data.children
    .map(
      (c) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${c.firstName} (${c.yearGroup})</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">£${(c.amountPence / 100).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const dueFormatted = new Date(data.dueDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#1d4ed8;padding:24px;color:#fff">
      <p style="margin:0;font-size:13px;opacity:0.8">${data.schoolName}</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700">${data.requestTitle}</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#374151;margin:0 0 16px">Dear Parent/Guardian,</p>
      <p style="color:#374151;margin:0 0 20px">
        ${data.isReminder
          ? `This is a reminder that payment is still outstanding. Please pay by <strong>${dueFormatted}</strong>.`
          : `A payment request has been created. Please pay by <strong>${dueFormatted}</strong>.`}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:12px;color:#6b7280;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Child</th>
            <th style="text-align:right;font-size:12px;color:#6b7280;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Amount</th>
          </tr>
        </thead>
        <tbody>${childrenHtml}</tbody>
        <tfoot>
          <tr>
            <td style="padding-top:12px;font-weight:700;color:#111827">Total</td>
            <td style="padding-top:12px;font-weight:700;color:#111827;text-align:right">${totalStr}</td>
          </tr>
        </tfoot>
      </table>
      <a href="${payUrl}" style="display:block;background:#1d4ed8;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;margin-bottom:20px">
        Pay ${totalStr} now →
      </a>
      <p style="font-size:12px;color:#9ca3af;margin:0">
        This link is personal to you and expires in 7 days. Do not share it.<br>
        Questions? Contact ${data.schoolName} directly.
      </p>
    </div>
  </div>
</body>
</html>`;

  const { data: result, error } = await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `${data.isReminder ? "Reminder: " : ""}Payment request: ${data.requestTitle} — ${data.schoolName}`,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    return null;
  }

  return result?.id ?? null;
}

export interface PaymentConfirmationData {
  email: string;
  requestTitle: string;
  schoolName: string;
  children: Array<{
    firstName: string;
    yearGroup: string;
    amountPence: number;
  }>;
}

export async function sendPaymentConfirmation(data: PaymentConfirmationData): Promise<string | null> {
  const totalPence = data.children.reduce((s, c) => s + c.amountPence, 0);
  const totalStr = `£${(totalPence / 100).toFixed(2)}`;

  const childrenHtml = data.children
    .map(
      (c) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${c.firstName} (${c.yearGroup})</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">£${(c.amountPence / 100).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#16a34a;padding:24px;color:#fff">
      <p style="margin:0;font-size:13px;opacity:0.8">${data.schoolName}</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700">Payment confirmed ✓</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#374151;margin:0 0 16px">Dear Parent/Guardian,</p>
      <p style="color:#374151;margin:0 0 20px">
        Thank you — your payment for <strong>${data.requestTitle}</strong> has been received and confirmed.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:12px;color:#6b7280;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Child</th>
            <th style="text-align:right;font-size:12px;color:#6b7280;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Amount paid</th>
          </tr>
        </thead>
        <tbody>${childrenHtml}</tbody>
        <tfoot>
          <tr>
            <td style="padding-top:12px;font-weight:700;color:#111827">Total paid</td>
            <td style="padding-top:12px;font-weight:700;color:#16a34a;text-align:right">${totalStr}</td>
          </tr>
        </tfoot>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin:0">
        Please keep this email as your receipt.<br>
        Questions? Contact ${data.schoolName} directly.
      </p>
    </div>
  </div>
</body>
</html>`;

  const { data: result, error } = await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Payment confirmed: ${data.requestTitle} — ${data.schoolName}`,
    html,
  });

  if (error) {
    console.error("Resend error (confirmation):", error);
    return null;
  }

  return result?.id ?? null;
}
