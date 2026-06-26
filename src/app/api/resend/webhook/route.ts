import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Raw body required for svix signature verification
export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const rawBody = await req.text();

  // Verify svix signature — rejects unsigned or tampered requests
  const wh = new Webhook(secret);
  let event: { type: string; data: Record<string, unknown> };
  try {
    event = wh.verify(rawBody, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    } as Record<string, string>) as typeof event;
  } catch (err) {
    console.error("[resend-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const db = serviceClient();

  if (event.type === "email.bounced") {
    const emailId = event.data.email_id as string | undefined;
    if (emailId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db.from("email_log") as any)
        .update({ bounced_at: new Date().toISOString() })
        .eq("resend_message_id", emailId)
        .is("bounced_at", null); // idempotent — don't re-stamp if already set

      if (error) {
        console.error("[resend-webhook] failed to mark bounce:", error);
        return NextResponse.json({ error: "db error" }, { status: 500 });
      }
      console.log(`[resend-webhook] marked email_log bounced: ${emailId}`);
    }
  }

  // All other Resend event types: log and return 200
  console.log(`[resend-webhook] received: ${event.type}`);
  return NextResponse.json({ received: true });
}
