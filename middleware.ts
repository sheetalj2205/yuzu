import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the session alive.
 *
 * Supabase access tokens expire. Without this, a refresh mid-cycle drops the
 * user back to the login screen. Calling getUser() here refreshes the token and
 * writes the rotated cookies onto the response.
 */

/**
 * Keep people signed in.
 *
 * Supabase hands us cookie options carrying the ACCESS token's lifetime — an
 * hour. Writing that verbatim means the browser drops the cookie an hour later
 * and they are asked to sign in again, even though the refresh token was good
 * for far longer. So every auth cookie we write is given the longest life a
 * browser will keep (400 days is the cap). Signing out still clears them.
 */
const KEEP = 60 * 60 * 24 * 400;
const longLived = (o: CookieOptions): CookieOptions => ({ ...o, maxAge: KEEP, path: "/" });

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value } of list) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of list) res.cookies.set(name, value, longLived(options));
        },
      },
    },
  );

  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-|apple-touch-icon|manifest|sw.js|.*\\.png$).*)"],
};
