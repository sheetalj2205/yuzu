"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registering his phone to be buzzed while the app is closed.
 *
 * The browser gives us an "endpoint", an address its push service will deliver
 * to, plus two keys so only we can encrypt for it. We keep those, and later the
 * server posts her cramp to that address. His phone wakes the service worker,
 * which shows a notification carrying a vibration pattern.
 */

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushState = "unsupported" | "denied" | "ready" | "prompt";

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "ready";
  return "prompt";
}

/**
 * Ask, subscribe, and store. Must be called from a real click, browsers refuse
 * a permission prompt that the user did not trigger.
 */
export async function enablePush(sb: SupabaseClient, userId: string): Promise<PushState> {
  if (pushState() === "unsupported") return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "prompt";

  const reg = await navigator.serviceWorker.ready;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "unsupported";

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,                       // required by Chrome
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "unsupported";

  await sb.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: "endpoint" },
  );

  return "ready";
}
