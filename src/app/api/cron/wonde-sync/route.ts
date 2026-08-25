import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncSchoolFromWonde } from "@/lib/wonde";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = getAdmin();

  const { data: schools } = await (admin.from("schools") as any)
    .select("id, name, wonde_token")
    .not("wonde_token", "is", null) as {
      data: Array<{ id: string; name: string; wonde_token: string }> | null
    };

  if (!schools?.length) {
    return NextResponse.json({ ok: true, synced: 0, message: "No schools with Wonde configured" });
  }

  const results: Array<{ school: string; students: number; guardians: number; links: number; error?: string }> = [];

  for (const school of schools) {
    try {
      const counts = await syncSchoolFromWonde(school.wonde_token, school.id);
      results.push({ school: school.name, ...counts });
    } catch (err) {
      results.push({
        school: school.name,
        students: 0,
        guardians: 0,
        links: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
