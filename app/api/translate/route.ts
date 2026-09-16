import { NextResponse } from "next/server";
import { buildPrompt, fallback, normalise } from "@/lib/translate";
import { cacheGet, cacheKey, cacheSet } from "@/lib/cache";

export const runtime = "edge";   // fast + cheap on Vercel

/**
 * Her words in → a buzz pattern, every need she mentioned, and his hints out.
 *
 * Gemini runs in the cloud, so this works for anyone who opens the deployed
 * app — no local model, no laptop on the same wifi. The browser never calls
 * Gemini directly: the key stays server-side and her message never reaches
 * the client of whoever is guessing.
 */

/** Gemini returns JSON matching this shape — no "please reply with JSON" pleading. */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    envelope:   { type: "string", enum: ["swell", "stab", "grind", "throb"] },
    peak:       { type: "number" },
    pulse_ms:   { type: "number" },
    duration_s: { type: "number" },
    label:      { type: "string" },
    needs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tag:   { type: "string", enum: ["heat", "meds", "rest", "company", "warmth"] },
          label: { type: "string" },
          hints: { type: "array", items: { type: "string" } },
        },
        required: ["tag", "label", "hints"],
      },
    },
  },
  required: ["envelope", "peak", "pulse_ms", "duration_s", "label", "needs"],
};

export async function POST(req: Request) {
  const { message, intensity } = await req.json();
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const level = Math.min(10, Math.max(1, Number(intensity) || 5));

  // Same words, same intensity? Reuse the answer. At a demo this is most of the traffic.
  const ck = cacheKey(message, level);
  const cached = cacheGet(ck);
  if (cached) return NextResponse.json(cached);

  const key = process.env.GEMINI_API_KEY;

  /**
   * A chain, not a single model — tried in order until one answers.
   *
   * Two things bite you otherwise, and both did during testing:
   *  - Google retires versions (gemini-2.0-flash is already gone → 404)
   *  - popular models return 503 "high demand" at random moments, which is
   *    exactly what you do not want mid-demo
   *
   * "gemini-flash-latest" follows whatever is current; the pinned one behind it
   * is the safety net. Override with a comma-separated GEMINI_MODEL if you like.
   */
  const models = (process.env.GEMINI_MODEL ?? "gemini-flash-latest,gemini-3.5-flash")
    .split(",").map(m => m.trim()).filter(Boolean);

  if (!key) {
    console.warn("[translate] no GEMINI_API_KEY — using built-in rules");
    return NextResponse.json(fallback(message, level));
  }

  let lastError = "no models tried";

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: buildPrompt(message, level) }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!res.ok) {
        lastError = `${model} → ${res.status}`;
        continue;                       // overloaded or gone: try the next one
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastError = `${model} → empty`; continue; }

      const out = normalise(JSON.parse(text), level);
      cacheSet(ck, out);
      return NextResponse.json(out);
    } catch (err) {
      lastError = `${model} → ${(err as Error).message}`;
    }
  }

  // Every model failed. The demo does not stop.
  console.warn("[translate] falling back:", lastError);
  return NextResponse.json(fallback(message, level));
}
