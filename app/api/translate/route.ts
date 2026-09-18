import { NextResponse } from "next/server";
import { buildPrompt, fallback, normalise } from "@/lib/translate";
import { cacheGet, cacheKey, cacheSet } from "@/lib/cache";
import type { Translation } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Her words in → a buzz pattern, every need she mentioned, and his hints out.
 *
 * Gemini, with the built-in rules behind it. The rules cannot fail: no key and
 * no network needed, so the demo never dies on stage.
 *
 * (There was a second provider on a university gateway for a while. It stopped
 * being reachable off campus, and a provider you cannot reach from the machine
 * you are demoing on is worse than none at all: every message sat through its
 * timeout before the working one got a turn.)
 *
 * None of it runs in the browser: the key stays server-side, and her message
 * never reaches the phone of the person trying to guess it.
 */

/** Gemini returns JSON matching this shape, no "please reply with JSON" pleading. */
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

type Attempt = { ok: true; value: Translation } | { ok: false; why: string };

/**
 * Gemini, a chain, because Google retires versions (2.0-flash is already a 404)
 * and popular models return 503 "high demand" at random moments.
 * "-lite" models have no reasoning to switch off and reject thinkingConfig.
 */
async function tryGemini(prompt: string, level: number, message: string): Promise<Attempt> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, why: "gemini not configured" };

  const models = (process.env.GEMINI_MODEL
    ?? "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-flash-latest")
    .split(",").map(m => m.trim()).filter(Boolean);

  let why = "no gemini models tried";
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              // reasoning costs 6+ seconds on what is really classification
              ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
            },
          }),
          signal: AbortSignal.timeout(25_000),
        },
      );
      if (!res.ok) { why = `${model} → ${res.status}`; continue; }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { why = `${model} → empty`; continue; }

      return { ok: true, value: normalise(JSON.parse(text), level, message) };
    } catch (err) {
      why = `${model} → ${(err as Error).message}`;
    }
  }
  return { ok: false, why };
}

export async function POST(req: Request) {
  const { message, intensity } = await req.json();
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const level = Math.min(10, Math.max(1, Number(intensity) || 5));

  // Same words, same intensity? Reuse the answer. At a demo that is most of the traffic.
  const ck = cacheKey(message, level);
  const cached = cacheGet(ck);
  if (cached) return NextResponse.json(cached);

  const attempt = await tryGemini(buildPrompt(message, level), level, message);
  if (attempt.ok) {
    const value = { ...attempt.value, by: "gemini" };
    cacheSet(ck, value);
    return NextResponse.json(value);
  }

  // Gemini is out. The rules take over and nobody watching can tell.
  console.warn("[translate] falling back to rules:", attempt.why);
  return NextResponse.json(fallback(message, level));
}
