import { NextResponse } from "next/server";
import { buildPrompt, fallback, normalise } from "@/lib/translate";
import { cacheGet, cacheKey, cacheSet } from "@/lib/cache";
import type { Translation } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Her words in → a buzz pattern, every need she mentioned, and his hints out.
 *
 * Three providers, tried in order, and the last one cannot fail:
 *
 *   1. BullsAI, the primary
 *   2. Gemini, if BullsAI is down or unset
 *   3. built-in rules, if both are, so the demo never dies on stage
 *
 * None of it runs in the browser: the keys stay server-side, and her message
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

/** Set when the BullsAI gateway refuses to connect, so we stop waiting on it. */
const BULLSAI_COOLDOWN = 3 * 60_000;
let bullsaiDownUntil = 0;

/**
 * BullsAI, OpenAI chat-completions shape.
 *
 * ALT_AI_MODEL takes a comma-separated list, tried in order, same as Gemini.
 *
 * Kept on a SHORT leash. This gateway lives on a university network and has
 * been seen refusing connections outright, and when it does, every model in the
 * list burns the full timeout before Gemini gets a turn. She is staring at
 * "Reading her words..." the whole time. Better to give up quickly and let the
 * provider behind it answer.
 */
async function tryBullsAI(prompt: string, level: number): Promise<Attempt> {
  const base = process.env.ALT_AI_BASE_URL;
  const key  = process.env.ALT_AI_API_KEY;
  const models = (process.env.ALT_AI_MODEL ?? "").split(",").map(m => m.trim()).filter(Boolean);
  if (!base || !key || !models.length) return { ok: false, why: "bullsai not configured" };

  // If the gateway just refused to connect, do not sit through the timeout
  // again on every message for the next few minutes.
  if (Date.now() < bullsaiDownUntil) return { ok: false, why: "bullsai unreachable, skipping" };

  let why = "no bullsai models tried";
  for (const model of models) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) { why = `${model} → ${res.status}`; continue; }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) { why = `${model} → empty`; continue; }

      return { ok: true, value: normalise(JSON.parse(text), level) };
    } catch (err) {
      const msg = (err as Error).message;
      why = `${model} → ${msg}`;
      // A refused connection or a timeout is the gateway itself, not the model.
      // Trying the next one just burns another timeout while she waits.
      if (/fetch failed|timed? ?out|abort|ENOTFOUND|ECONN/i.test(msg)) {
        bullsaiDownUntil = Date.now() + BULLSAI_COOLDOWN;
        return { ok: false, why: `${why} (gateway down, backing off)` };
      }
    }
  }
  return { ok: false, why };
}

/**
 * Gemini, a chain, because Google retires versions (2.0-flash is already a 404)
 * and popular models return 503 "high demand" at random moments.
 * "-lite" models have no reasoning to switch off and reject thinkingConfig.
 */
async function tryGemini(prompt: string, level: number): Promise<Attempt> {
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

      return { ok: true, value: normalise(JSON.parse(text), level) };
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

  const prompt = buildPrompt(message, level);
  const reasons: string[] = [];

  for (const [name, provider] of [["bullsai", tryBullsAI], ["gemini", tryGemini]] as const) {
    const attempt = await provider(prompt, level);
    if (attempt.ok) {
      // say who answered, so "which model is this?" is never a guess
      console.log(`[translate] ${name} answered${reasons.length ? ` (after ${reasons.join(", ")})` : ""}`);
      const value = { ...attempt.value, by: name };
      cacheSet(ck, value);
      return NextResponse.json(value);
    }
    reasons.push(attempt.why);
  }

  console.warn("[translate] falling back to rules:", reasons.join(" | "));
  return NextResponse.json(fallback(message, level));
}
