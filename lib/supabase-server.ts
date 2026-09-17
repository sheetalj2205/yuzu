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
 * Supabase hands us cookie options carrying the ACCESS token's lifetime, about
 * an hour. Writing that verbatim means the browser drops the cookie an hour
 * later and they are asked to sign in again, even though the refresh token was
 * good for far longer. So a real cookie is given the longest life a browser
 * will keep.
 *
 * A DELETION must be left alone. Supabase removes a cookie by writing an empty
 * value with maxAge 0, and blanket-extending that resurrected the PKCE verifier
 * for 400 days. Stale verifier chunks then piled up and the next sign-in could
 * not read a clean one: "PKCE code verifier not found in storage".
 */
const KEEP = 60 * 60 * 24 * 400;
const longLived = (o: CookieOptions, value: string): CookieOptions =>
  value === "" || o?.maxAge === 0 ? o : { ...o, maxAge: KEEP, path: "/" };

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
            for (const { name, value, options } of list) store.set(name, value, longLived(options, value));
          } catch {
            // called from a Server Component, middleware refreshes instead
          }
        },
      },
    },
  );
}
