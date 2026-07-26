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

export interface DinnerTopUpConfirmationData {
  email: string;
  schoolName: string;
  studentName: string;
  amountPence: number;
  balanceAfterPence: number;
}

export async function sendDinnerTopUpConfirmation(data: DinnerTopUpConfirmationData): Promise<string | null> {
  const amountStr = `£${(data.amountPence / 100).toFixed(2)}`;
  const balanceStr = `£${(data.balanceAfterPence / 100).toFixed(2)}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#2563eb;padding:24px;color:#fff">
      <p style="margin:0;font-size:13px;opacity:0.8">${data.schoolName}</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700">Dinner money topped up ✓</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#374151;margin:0 0 16px">Dear Parent/Guardian,</p>
      <p style="color:#374151;margin:0 0 20px">Your dinner money top-up for <strong>${data.studentName}</strong> has been received.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280">Amount added</td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111827">${amountStr}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;font-weight:700;color:#111827">New balance</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700;color:#2563eb">${balanceStr}</td>
        </tr>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin:0">Please keep this email as your receipt.<br>Questions? Contact ${data.schoolName} directly.</p>
    </div>
  </div>
</body>
</html>`;

  const { data: result, error } = await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Dinner money topped up — ${data.studentName} — ${data.schoolName}`,
    html,
  });

  if (error) {
    console.error("Resend error (dinner topup):", error);
    return null;
  }

  return result?.id ?? null;
}

export interface ShopOrderConfirmationData {
  email: string;
  schoolName: string;
  items: Array<{ name: string; quantity: number; unitPricePence: number }>;
}

export async function sendShopOrderConfirmation(data: ShopOrderConfirmationData): Promise<string | null> {
  const totalPence = data.items.reduce((s, i) => s + i.unitPricePence * i.quantity, 0);
  const totalStr = `£${(totalPence / 100).toFixed(2)}`;

  const itemsHtml = data.items
    .map((i) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb">${i.name} × ${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">£${((i.unitPricePence * i.quantity) / 100).toFixed(2)}</td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#16a34a;padding:24px;color:#fff">
      <p style="margin:0;font-size:13px;opacity:0.8">${data.schoolName}</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700">Order confirmed ✓</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#374151;margin:0 0 16px">Dear Parent/Guardian,</p>
      <p style="color:#374151;margin:0 0 20px">Thank you — your school shop order has been placed and payment confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr>
          <th style="text-align:left;font-size:12px;color:#6b7280;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Item</th>
          <th style="text-align:right;font-size:12px;color:#6b7280;padding-bottom:4px;text-transform:uppercase;letter-spacing:0.05em">Amount</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot><tr>
          <td style="padding-top:12px;font-weight:700;color:#111827">Total paid</td>
          <td style="padding-top:12px;font-weight:700;color:#16a34a;text-align:right">${totalStr}</td>
        </tr></tfoot>
      </table>
      <p style="font-size:12px;color:#9ca3af;margin:0">Your order will be distributed by the school. Please keep this email as your receipt.<br>Questions? Contact ${data.schoolName} directly.</p>
    </div>
  </div>
</body>
</html>`;

  const { data: result, error } = await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Order confirmed — ${data.schoolName} school shop`,
    html,
  });

  if (error) {
    console.error("Resend error (shop order):", error);
    return null;
  }

  return result?.id ?? null;
}

export async function sendClubWaitlistConfirmation(data: {
  email: string;
  clubName: string;
  schoolName: string;
  childName: string;
  position: number;
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Waiting list confirmation — ${data.clubName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <div style="background:#d97706;padding:24px;color:#fff">
          <p style="margin:0;font-size:13px;opacity:0.8">${data.schoolName}</p>
          <h1 style="margin:4px 0 0;font-size:20px;font-weight:700">You're on the waiting list</h1>
        </div>
        <div style="padding:24px;color:#374151">
          <p>Dear Parent/Guardian,</p>
          <p><strong>${data.clubName}</strong> is currently full. We've added <strong>${data.childName}</strong> to the waiting list.</p>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0;font-weight:600;color:#92400e">Waiting list position: #${data.position}</p>
          </div>
          <p>We'll email you automatically if a place becomes available. No payment is needed until a place is confirmed.</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:24px">Questions? Contact ${data.schoolName} directly.<br>School2Pay · school2pay.com</p>
        </div>
      </div>
    `,
  });
}

export async function sendClubEnrollmentConfirmation(data: {
  email: string;
  clubName: string;
  schoolName: string;
  childName: string;
  amountPence: number;
  dayOfWeek: string | null;
  startDate: string | null;
}): Promise<void> {
  const amount = `£${(data.amountPence / 100).toFixed(2)}`;
  const startStr = data.startDate
    ? new Date(data.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Enrolled: ${data.clubName} — ${data.schoolName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <div style="background:#16a34a;padding:24px;color:#fff">
          <p style="margin:0;font-size:13px;opacity:0.8">${data.schoolName}</p>
          <h1 style="margin:4px 0 0;font-size:20px;font-weight:700">Enrolled ✓</h1>
        </div>
        <div style="padding:24px;color:#374151">
          <p>Dear Parent/Guardian,</p>
          <p>Payment confirmed — <strong>${data.childName}</strong> is enrolled in <strong>${data.clubName}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
            <tr style="background:#f9fafb">
              <td style="padding:10px 14px;font-size:13px;color:#6b7280">Club</td>
              <td style="padding:10px 14px;font-weight:600">${data.clubName}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:13px;color:#6b7280">Child</td>
              <td style="padding:10px 14px;font-weight:600">${data.childName}</td>
            </tr>
            ${data.dayOfWeek ? `<tr style="background:#f9fafb"><td style="padding:10px 14px;font-size:13px;color:#6b7280">Day</td><td style="padding:10px 14px;font-weight:600">${data.dayOfWeek}s</td></tr>` : ""}
            ${startStr ? `<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280">Starts</td><td style="padding:10px 14px;font-weight:600">${startStr}</td></tr>` : ""}
            <tr style="background:#f9fafb">
              <td style="padding:10px 14px;font-size:13px;color:#6b7280">Amount paid</td>
              <td style="padding:10px 14px;font-weight:600;color:#16a34a">${amount}</td>
            </tr>
          </table>
          <p style="font-size:12px;color:#9ca3af">Please keep this email as your receipt. Questions? Contact ${data.schoolName} directly.<br>School2Pay · school2pay.com</p>
        </div>
      </div>
    `,
  });
}
