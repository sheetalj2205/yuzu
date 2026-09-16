import { NextResponse } from "next/server";

/** Google sends the user back here. Swap the code for a session, then onboard. */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const next = searchParams.get("next") ?? "/onboarding";
  return NextResponse.redirect(`${origin}${next}`);
}
