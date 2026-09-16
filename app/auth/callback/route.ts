import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Google sends the user back here with a one-time ?code.
 *
 * That code is NOT a session. It has to be exchanged for tokens, and the
 * resulting cookies written to the response — otherwise the browser lands on
 * the next page with no session at all and gets bounced straight back to login.
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent("No code returned from Google")}`);
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
