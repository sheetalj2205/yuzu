import { NextResponse } from "next/server";
import { buildPrompt, fallback, normalise } from "@/lib/translate";
import { cacheGet, cacheKey, cacheSet } from "@/lib/cache";

export const runtime = "nodejs";   // edge runtime is deprecated as of Next 16

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
  const models = (process.env.GEMINI_MODEL
    ?? "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-flash-latest")
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
              /**
               * Gemini 3.x reasons before answering, which costs 6+ seconds on a
               * task that is really classification plus three short lines. Turning
               * it off took 8.3s down to 2.3s with no loss in quality.
               *
               * The "-lite" models have no thinking to disable and reject the
               * option outright with a 400, so they do not get it.
               */
              ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
            },
          }),
          // 12s was a real measured response time before thinking was disabled —
          // leave generous headroom so a slow answer is not thrown away.
          signal: AbortSignal.timeout(25_000),
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

  /**
   * Gemini is out. Try a second provider before giving up on AI entirely.
   *
   * Written against the OpenAI chat-completions shape, which most hosted
   * providers speak — set the base URL, key and model and it just works.
   * Today Gemini returned 503 "high demand" several times in a row, so this is
   * not theoretical.
   */
  const altBase  = process.env.ALT_AI_BASE_URL;
  const altKey   = process.env.ALT_AI_API_KEY;
  const altModel = process.env.ALT_AI_MODEL;

  if (altBase && altKey && altModel) {
    try {
      const res = await fetch(`${altBase.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${altKey}` },
        body: JSON.stringify({
          model: altModel,
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: buildPrompt(message, level) }],
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          const out = normalise(JSON.parse(text), level);
          cacheSet(ck, out);
          return NextResponse.json(out);
        }
        lastError = `${altModel} → empty`;
      } else {
        lastError = `${altModel} → ${res.status}`;
      }
    } catch (err) {
      lastError = `${altModel} → ${(err as Error).message}`;
    }
  }

  // Every provider failed. The demo does not stop.
  console.warn("[translate] falling back:", lastError);
  return NextResponse.json(fallback(message, level));
}
