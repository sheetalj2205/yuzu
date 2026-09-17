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
    // No options on purpose. @supabase/ssr already forces persistSession,
    // autoRefreshToken, detectSessionInUrl, PKCE and cookie storage, and passing
    // our own auth block only invites someone to "helpfully" override the
    // storage adapter later and break the login flow. Cookie lifetime is set
    // where the cookies are actually written: middleware and supabase-server.
  );
  return client;
};

/** The only way out, nothing else signs anyone out. */
export async function signOut() {
  await supabase().auth.signOut();
  location.href = "/";
}
