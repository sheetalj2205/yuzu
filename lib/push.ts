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
 * Quietly put back a subscription that has gone missing.
 *
 * Safari revokes a push subscription when a push arrives and nothing is shown,
 * and it leaves the PERMISSION granted while doing it. So his phone looked
 * fine: permission granted, nothing to prompt him about, and the app never
 * offered him the button again, because the button only appears when he has
 * not been asked yet. Notifications stayed dead for good.
 *
 * This runs on every load. No prompt, no click needed, because permission is
 * already his. It is only ever a repair.
 */
export async function ensurePush(sb: SupabaseClient, userId: string): Promise<PushState> {
  if (pushState() !== "ready") return pushState();
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "unsupported";

  try {
    const reg = await navigator.serviceWorker.ready;
    if (await reg.pushManager.getSubscription()) return "ready";   // nothing to repair
    return await store(sb, userId, await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  } catch {
    return "ready";   // permission is still his; the in-app buzz carries on
  }
}

/** Keep the address his push service delivers to, so the server can reach him. */
async function store(sb: SupabaseClient, userId: string, sub: PushSubscription): Promise<PushState> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "unsupported";
  await sb.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
    { onConflict: "endpoint" },
  );
  return "ready";
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

  return store(sb, userId, sub);
}

/**
 * Which service worker is actually running on this phone.
 *
 * iOS keeps an installed app's old worker alive far longer than you expect, and
 * a stale push handler is invisible from every other angle: the server sends,
 * Apple returns 201, and the phone stays dark. update() also pulls a newer
 * worker down if one is sitting waiting, so asking the question tends to fix it.
 */
export async function workerVersion(): Promise<string> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "none";
  try {
    const reg = await navigator.serviceWorker.ready;
    void reg.update();
    const sw = reg.active;
    if (!sw) return "none";
    return await new Promise<string>((resolve) => {
      const channel = new MessageChannel();
      const giveUp = setTimeout(() => resolve("too old to answer"), 2000);
      channel.port1.onmessage = (e) => {
        clearTimeout(giveUp);
        resolve(String((e.data as { version?: string })?.version ?? "?"));
      };
      sw.postMessage("version", [channel.port2]);
    });
  } catch {
    return "?";
  }
}

export type TestResult = { ok: boolean; detail: string };

/**
 * Push one notification to this very phone, down the exact path a real cramp
 * takes. If this arrives and a cramp does not, the fault is not delivery.
 */
export async function testPush(): Promise<TestResult> {
  try {
    const res = await fetch("/api/push", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        self: true, title: "Yuzu test 🔔",
        body: "Push works. A real one will feel like this.",
        tag: "yuzu-test", vibrate: [300, 120, 300],
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (out?.sent > 0) return { ok: true, detail: "Sent. It should appear now." };
    if (out?.reason) return { ok: false, detail: out.reason };
    if (out?.failed) return { ok: false, detail: `Apple refused ${out.failed} of ${out.had}.` };
    if (out?.pruned) return { ok: false, detail: "Your subscription had expired. Reopen and try again." };
    return { ok: false, detail: out?.error ?? "Nothing was sent." };
  } catch {
    return { ok: false, detail: "Could not reach the server." };
  }
}
