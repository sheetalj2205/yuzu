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
 * The session itself is meant to last: Supabase refreshes it in the background,
 * middleware rotates the cookies on every request, and the cookie is set to
 * live a year. Nobody gets signed out unless they ask to be.
 */
export const supabase = (): SupabaseClient => {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365,   // a year, not a browser session
        sameSite: "lax",
        secure: typeof location !== "undefined" && location.protocol === "https:",
        path: "/",
      },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    },
  );
  return client;
};

/** The only way out — nothing else signs anyone out. */
export async function signOut() {
  await supabase().auth.signOut();
  location.href = "/";
}
