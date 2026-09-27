import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { wondeAuthoriseUrl } from "@/lib/wonde";
import { randomBytes } from "crypto";

// Redirect admin to Wonde OAuth authorisation page
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const state = randomBytes(16).toString("hex");

  // Store state in cookie for CSRF check in callback
  const response = NextResponse.redirect(wondeAuthoriseUrl(state));
  response.cookies.set("wonde_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    path: "/",
    sameSite: "lax",
  });

  return response;
}
