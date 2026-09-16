"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * One auth client for the whole tab.
 *
 * Creating a fresh one per call spawns several auth instances that each try to
 * refresh the same token, and they can race each other into signing you out.
 * One instance, kept.
 *
 * The session itself is meant to last: Supabase refreshes it in the background
 * and middleware rotates the cookies on every request, writing them with a long
 * life. Nobody gets signed out unless they ask to be.
 */
export const supabase = (): SupabaseClient => {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // NB: @supabase/ssr accepts cookieOptions but ignores maxAge, so cookie
    // lifetime is set where we actually write them — middleware and
    // lib/supabase-server.ts.
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  );
  return client;
};

/** The only way out — nothing else signs anyone out. */
export async function signOut() {
  await supabase().auth.signOut();
  location.href = "/";
}
