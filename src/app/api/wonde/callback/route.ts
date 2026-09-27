import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { exchangeWondeCode } from "@/lib/wonde";
import type { Database } from "@/lib/supabase/types";

function getAdmin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/onboarding?wonde_error=${encodeURIComponent(error)}`);
  }

  // CSRF check
  const storedState = req.cookies.get("wonde_oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${APP_URL}/onboarding?wonde_error=state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/onboarding?wonde_error=no_code`);
  }

  try {
    const { access_token, school_id: wondeSchoolId } = await exchangeWondeCode(code);

    // Find the admin's school and update with Wonde credentials
    const { data: school } = await supabase.from("schools").select("id, trust_id").single();
    if (!school) return NextResponse.redirect(`${APP_URL}/onboarding?wonde_error=no_school`);

    const admin = getAdmin();
    await (admin as any)
      .from("schools")
      .update({
        wonde_school_id: wondeSchoolId,
        wonde_token: access_token,
      })
      .eq("id", school.id);

    // Clear state cookie and redirect to trigger initial sync
    const response = NextResponse.redirect(`${APP_URL}/onboarding/wonde-sync`);
    response.cookies.delete("wonde_oauth_state");
    return response;
  } catch (e) {
    console.error("[wonde/callback] error:", e);
    return NextResponse.redirect(`${APP_URL}/onboarding?wonde_error=token_exchange_failed`);
  }
}
