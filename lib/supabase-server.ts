import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase on the server, wired to Next's cookie store.
 *
 * This is what actually creates the session: Google hands back a one-time code,
 * and only a server client with cookie access can trade it for tokens the
 * browser will keep.
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

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            for (const { name, value, options } of list) store.set(name, value, longLived(options));
          } catch {
            // called from a Server Component — middleware refreshes instead
          }
        },
      },
    },
  );
}
