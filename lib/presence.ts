"use client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Who is actually looking at the app right now.
 *
 * The browser will not let a page vibrate, play sound or run its timers while
 * it is hidden — that is deliberate, and there is no way around it short of Web
 * Push. So Yuzu does not pretend he is trapped. He can close the app any time.
 *
 * He just cannot do it quietly.
 */
export type Presence = "here" | "away" | "gone";

export type PresenceMeta = { role: "her" | "him"; name: string; state: "here" | "away" };

/** Read the partner's state out of a Supabase presence map. */
export function readPartner(
  raw: Record<string, unknown[]>,
  myRole: "her" | "him",
): { presence: Presence; name: string | null } {
  const theirRole = myRole === "her" ? "him" : "her";

  for (const entries of Object.values(raw)) {
    for (const entry of entries) {
      const m = entry as Partial<PresenceMeta>;
      if (m?.role === theirRole) {
        return { presence: m.state === "away" ? "away" : "here", name: m.name ?? null };
      }
    }
  }
  return { presence: "gone", name: null };   // not in the channel at all
}

/**
 * Tell the channel whether this tab is being looked at, and keep telling it.
 * Returns a cleanup function.
 *
 * `visibilitychange` covers switching apps, locking the phone and tab switches.
 * `pagehide` covers closing it — more reliable than `beforeunload` on mobile.
 */
export function trackVisibility(channel: RealtimeChannel, meta: Omit<PresenceMeta, "state">) {
  const push = (state: PresenceMeta["state"]) => { void channel.track({ ...meta, state }); };

  const onVisibility = () => push(document.hidden ? "away" : "here");
  const onHide = () => push("away");

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onHide);
  push(document.hidden ? "away" : "here");

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onHide);
  };
}
