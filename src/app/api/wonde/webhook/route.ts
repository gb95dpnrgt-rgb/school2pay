import { NextRequest, NextResponse } from "next/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { syncSchoolFromWonde } from "@/lib/wonde";

// Wonde sends events here when pupil/contact data changes in the MIS
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wonde-webhook-secret");
  if (secret !== process.env.WONDE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  console.log("[wonde/webhook] event:", body.event, "school:", body.school_id);

  const db = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: school } = await (db as any)
    .from("schools")
    .select("id, wonde_token")
    .not("wonde_token", "is", null)
    .limit(1)
    .single();

  if (!school?.wonde_token) {
    return NextResponse.json({ error: "No connected school" }, { status: 404 });
  }

  try {
    await syncSchoolFromWonde(school.wonde_token, school.id);
  } catch (err) {
    console.error("[wonde/webhook] sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
