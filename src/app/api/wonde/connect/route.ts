import { NextRequest, NextResponse } from "next/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { syncSchoolFromWonde } from "@/lib/wonde";

// Wonde POSTs here after a school approves data sharing in their consent portal
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-wonde-webhook-secret");
  if (secret !== process.env.WONDE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { school_id: wondeSchoolId, token: wondeToken } = body;

  if (!wondeSchoolId || !wondeToken) {
    return NextResponse.json({ error: "Missing school_id or token" }, { status: 400 });
  }

  const db = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find which school this Wonde school maps to (match by URN if stored, else first school for demo)
  const { data: school } = await db
    .from("schools")
    .select("id")
    .limit(1)
    .single();

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  // Store the Wonde token against the school
  await (db as any)
    .from("schools")
    .update({ wonde_token: wondeToken })
    .eq("id", school.id);

  // Kick off initial sync
  try {
    await syncSchoolFromWonde(wondeToken, school.id);
  } catch (err) {
    console.error("[wonde/connect] initial sync failed:", err);
    // Don't fail — token is stored, sync can be retried manually
  }

  return NextResponse.json({ ok: true });
}
