import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncSchoolFromWonde } from "@/lib/wonde";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: school } = await supabase
    .from("schools")
    .select("id, wonde_token")
    .single();

  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });
  if (!(school as any).wonde_token) {
    return NextResponse.json({ error: "Wonde not connected" }, { status: 400 });
  }

  try {
    const counts = await syncSchoolFromWonde((school as any).wonde_token, school.id);
    return NextResponse.json({ ok: true, ...counts });
  } catch (err) {
    console.error("[wonde/sync] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
