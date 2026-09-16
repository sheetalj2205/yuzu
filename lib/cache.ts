/**
 * A tiny TTL cache for translations.
 *
 * Two jobs:
 *  1. At a demo, lots of people type the same thing ("cramps", "my stomach hurts").
 *     One Gemini call serves all of them.
 *  2. It is what makes the QR moment safe: forty phones opening /demo all send the
 *     same preset message, so that is ONE call, not forty — no rate limit, no 429.
 *
 * Honest limit: this lives in the memory of one serverless instance. Vercel may run
 * several, so it is a hit-rate improvement, not a guarantee. That is fine — the
 * fallback in the route already covers the miss case.
 */
const TTL_MS = 10 * 60_000;
const MAX = 200;

type Entry = { value: unknown; expires: number };
const store = new Map<string, Entry>();

export const cacheKey = (message: string, intensity: number) =>
  `${intensity}:${message.trim().toLowerCase().replace(/\s+/g, " ")}`;

export function cacheGet(key: string): unknown | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { store.delete(key); return null; }
  // refresh recency
  store.delete(key);
  store.set(key, hit);
  return hit.value;
}

export function cacheSet(key: string, value: unknown) {
  if (store.size >= MAX) {
    const oldest = store.keys().next().value;   // insertion order = least recent
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + TTL_MS });
}
