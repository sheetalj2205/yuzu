import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase on the server, wired to Next's cookie store.
 *
 * This is what actually creates the session: Google hands back a one-time code,
 * and only a server client with cookie access can trade it for tokens the
 * browser will keep.
 */
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
            for (const { name, value, options } of list) store.set(name, value, options);
          } catch {
            // called from a Server Component — middleware refreshes instead
          }
        },
      },
    },
  );
}
