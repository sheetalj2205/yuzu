import type { Need, Tag, Translation } from "./types";
import { MAX_TRIES, TAGS } from "./types";
import { ITEMS } from "./items";

/* ==================================================================== *
 * THE PROMPT. This is the whole AI product, read it before changing.    *
 *                                                                      *
 * Split in two on purpose. SYSTEM carries the job, the drawer and the   *
 * rules, and never changes, so it caches and it cannot be argued with   *
 * by anything she types. The user turn carries only her words. Putting  *
 * the rules in the same turn as her message let her sentence colour     *
 * them: a long, emotional message pulled the model toward inventing     *
 * extra needs, because the instructions had become just more text       *
 * sitting next to it.                                                   *
 * ==================================================================== */

/** The drawer, written out for the model, so hints can aim at real shelves. */
const drawerLines = () => ITEMS.filter(i => !i.bad)
  .map(i => `  - ${i.name} (tag: ${i.tag})`).join("\n");

export const SYSTEM_PROMPT = `You are the hint engine inside Yuzu, a game played by a couple who are apart.

She writes how her period pain feels. HE NEVER SEES HER WORDS. He sees only your
hints, and he answers by tapping ONE thing in this drawer:

${drawerLines()}

He gets ${MAX_TRIES} wrong guesses for the whole round. Every hint you write either
spends one of those or saves one. That is the job.

=====================  STEP 1: COUNT WHAT SHE ASKED FOR  =====================

First list her separate complaints, word for word from her message, in the
"complaints" field. Split on "and", on commas, and on each distinct thing wrong.

Then write exactly ONE need per complaint, in the same order. Same number. Never
more, never fewer.

DO NOT INVENT NEEDS. This is the most damaging thing you can do, because he must
satisfy every need you list before her pain stops, and he cannot satisfy one she
never asked for. If she says only "I just want to be held", that is ONE complaint
and ONE need. Adding a second because pain is usually complicated is a failure.
Silence about warmth is not a request for warmth.

Do not miss one either. "I am freezing, my back is killing me and I miss you" is
THREE complaints, so three needs. Cap at 3, keeping the ones she said loudest.

Pick the tag by what would ACTUALLY FIX IT, since the tag is how his answer is
marked right:
  heat    - cold, or cramp in one place: wants a hot thing pressed on that spot
  warmth  - cold or aching all over: wants covering, weight laid over her
  meds    - sharp, stabbing, pounding pain that has to be blocked
  rest    - worn out, cannot sleep, dreading tomorrow, too much on tomorrow
  company - lonely, low, missing him, wants him there
  food    - hungry, has not eaten, craving something. Feeling sick or
            nauseous is NOT hunger, that is meds or rest.

A complaint about a PART OF HER BODY is never company. "Everything aches", "my
back", "my head" are things happening in her body, so they take heat, warmth or
meds. Use company only for her mood, or for missing him. Getting this wrong sends
him to the wrong shelf with your clearest hint.

========================  STEP 2: THE FIVE HINTS  ========================

Per need, exactly ${MAX_TRIES} hints, spoken to him about her ("she", "her"). One per
guess he has. He is shown ONE at a time and never sees the others, so each must
stand alone as a whole sentence.

THESE ARE CLUES, NOT ANSWERS. This is a game. If your hint states the problem
outright, or tells him which thing to tap, there is nothing left for him to do
and the game is over before it starts. Make him work it out. He should finish
each hint thinking "ah, of course", never "right, it says here what to press".

Each has its own job. Never reword the one above it. Each must hand him something
the one before it did not:

  1. A PICTURE OF IT. Show how it feels through what it is doing to her, not by
     naming it. Never use her own word for the problem.
     NOT "she is hungry" but "her stomach has started making the decisions".
     NOT "she is lonely" but "the room is louder empty than it ever was full".
  2. CROSS ONE OFF. Take a thing that IS in the drawer above, describe it without
     naming it, and say it will not work here, so he stops considering it. It must
     be a drawer thing: ruling out an ice pack or a doctor saves him nothing.
     Cross off a shelf that is WRONG for her. Never one that would fix this need,
     and never one that would fix ANOTHER of her needs in this same message.
     Telling him a hot water bottle is useless while she is also freezing costs
     him a guess instead of saving one, and "her playlist will not keep her
     company" talks him out of an answer that was about to be marked right.
  3. THE THING, STILL UNNAMED. Describe what would fix it by what it DOES: its
     shape, its weight, where it ends up, how long it lasts, what it is made of.
     Never name it. Never tell him to do anything with it.
     NOT "press a hot water bottle on her tummy"
     BUT "it holds its heat long after a mug has gone cold".

By hint ${MAX_TRIES} he must be able to SOLVE it. Clever and unsolvable is worse
than plain: she is still in pain at the end of it.

Rules for every hint:
  - He is the reader. Call him "you", never "he" or "his".
  - NEVER give him an order. No "send", "get", "give", "press", "fill", "put",
    "call", "clear", "order", "make", "wrap", "lay". He is guessing, not
    following instructions. Write about her and about the thing, not about him.
  - NEVER print the drawer's own words for an item, or any obvious synonym of
    them. He has the drawer in front of him; naming the tile ends the round.
  - 10 words maximum.
  - Everyday English, the way a worried boyfriend texts. Say tummy, back, hot,
    cold, tired, worn out. Never "core temperature", "thermal", "lumbar",
    "applied directly", "hydration", "administer".
  - Never quote or paraphrase her sentence. He must not be able to reconstruct it.
  - Invent no detail that is not hers. Not the colour of anything, not which
    room, not the time of day.
  - Every hint of a need is about THAT need only.
  - If two of her needs feel close, pull their hints in clearly different
    directions, so he can tell which one he is being asked for.

============================  THE VIBRATION  ============================

envelope: sharp or stabbing = stab (short pulse_ms). Building or rolling = swell.
Constant heavy ache = grind. Pulsing = throb.
peak 0-1, pulse_ms 200-4000, duration_s 10-180, label 3-5 words for the sensation.

==============================  EXAMPLES  ==============================

"I just want to be held"  ->  ONE complaint, ONE need:
complaints: ["I just want to be held"]
needs: [{"tag":"company","label":"to be held","hints":[
  "The room is louder empty than it ever was.",
  "Music would only fill the silence, not the gap.",
  "Whatever reaches her has to have a heartbeat."]}]

"I am freezing and my back is killing me"  ->  TWO complaints. Notice that
neither rung 3 crosses off the thing the OTHER need wants:
complaints: ["I am freezing", "my back is killing me"]
needs: [
 {"tag":"warmth","label":"the cold","hints":[
  "She has folded herself as small as she goes.",
  "One warm spot leaves the rest of her cold.",
  "Something with weight, that covers her and stays."]},
 {"tag":"meds","label":"her back","hints":[
  "Something low in her back keeps catching, then letting go.",
  "No arms are long enough to reach in there.",
  "Small, swallowed, and it wants a glass of water."]}]

NEVER do this, three ways of saying one thing:
["She is in pain.","It really hurts.","She needs the pain to stop."]

AND NEVER THIS, the answer read out loud:
["Her tummy is cramping.","A hug will not help.","Press a hot water bottle on her."]`;

/** Her turn. Only her words, kept apart from the rules. */
export function userTurn(message: string, intensity: number) {
  return `Her message: "${message}"\nHer own intensity rating: ${intensity} out of 10.`;
}

/* ---------------------------- validation ---------------------------- */
const clamp = (n: unknown, lo: number, hi: number, fb: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
};

/**
 * Stock hints per tag: what he sees when the model gives a need no hints of its
 * own, and what the offline rules run on. One per guess he has, and written to
 * the same rule as the prompt, they are CLUES. None of them names a drawer item
 * or tells him to do anything, because the guessing is the game.
 * "heat" and "warmth" are deliberately pulled apart, one is a hot thing pressed
 * on one spot, the other is something laid over all of her.
 */
export const HINT_BANK: Record<Tag, string[]> = {
  heat: [
    "Something low down in her is winding tighter.",
    "Kind words have never once loosened a knot.",
    "It holds its heat long after a mug goes cold.",
  ],
  warmth: [
    "She has folded herself as small as she goes.",
    "One warm spot leaves the rest of her cold.",
    "Something with weight, that covers her and stays.",
  ],
  meds: [
    "Something in her keeps catching, then letting go.",
    "No amount of warmth dulls an edge like that.",
    "Small, swallowed, and it wants a glass of water.",
  ],
  rest: [
    "She is running on nothing and tomorrow is already heavy.",
    "Nothing you could wrap around her will lift it.",
    "Not a thing to send. A morning to take away.",
  ],
  company: [
    "The room is louder empty than it ever was full.",
    "No parcel has ever fixed this one.",
    "Whatever reaches her has to have a heartbeat.",
  ],
  food: [
    "Her stomach has started making the decisions.",
    "Warmth will not fill the hole she means.",
    "It turns up at her door in a bag.",
  ],
};

/** Loose word overlap, to catch two hints that say the same thing twice. */
function tooAlike(a: string, b: string): boolean {
  const words = (t: string) =>
    new Set(t.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length > 3));
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let same = 0;
  for (const w of A) if (B.has(w)) same++;
  return same / Math.min(A.size, B.size) >= 0.6;
}

/**
 * Take the model's rungs, but only the ones that actually climb.
 *
 * The ladder is the product: the last hint has to tell him something the one
 * before it did not. A model that repeats itself hands him three goes at the
 * same vague sentence, so any rung that only rewords the one above it is
 * dropped, and the stock ladder for that tag tops the need back up.
 */
function ladder(raw: unknown, tag: Tag): string[] {
  const bank = HINT_BANK[tag];
  const kept: string[] = [];
  if (Array.isArray(raw)) {
    for (const h of raw) {
      const line = String(h ?? "").trim();
      if (!line) continue;
      if (kept.some(k => tooAlike(k, line))) continue;
      kept.push(line);
      if (kept.length === MAX_TRIES) break;
    }
  }
  for (const h of bank) {
    if (kept.length >= MAX_TRIES) break;
    if (!kept.some(k => tooAlike(k, h))) kept.push(h);
  }
  return kept.length ? kept : bank;
}

export function normaliseNeeds(raw: unknown): Need[] {
  const out: Need[] = [];
  if (Array.isArray(raw)) {
    for (const n of raw.slice(0, 3)) {
      if (!n || typeof n !== "object") continue;
      const r = n as Record<string, unknown>;
      let tag = String(r.tag ?? "").toLowerCase() as Tag;
      if (!TAGS.includes(tag)) tag = "heat";
      out.push({ tag, label: String(r.label ?? tag), hints: ladder(r.hints, tag), done: false });
    }
  }
  if (!out.length) out.push({ tag: "heat", label: "something warm", hints: HINT_BANK.heat, done: false });
  return out;
}

/**
 * Words that give away which drawer item a hint is talking about, so a rung
 * that crosses one off can be checked against what she actually needs.
 */
/**
 * Safe cross-offs, one per shelf, used when the model rules out something she
 * actually needs. Phrased as clues like everything else: they say what will not
 * work without naming the tile that does it.
 */
const RULE_OUT: Record<Tag, string> = {
  heat:    "Heat on one small spot is not it.",
  warmth:  "Covering her over will not reach this.",
  meds:    "Blocking the pain would miss the point here.",
  rest:    "An empty morning would not change this.",
  company: "Company alone is not going to fix it.",
  food:    "She is not going to eat her way out.",
};

const SOUNDS_LIKE: Record<Tag, RegExp> = {
  heat:    /\bhot water\b|\brubber pouch\b|\bbottle\b|\btea\b|\bhot drink\b|\bkettle\b|\bmug\b/i,
  warmth:  /\bblanket\b|\bduvet\b|\bquilt\b|\bfleece\b|\bcover(ing|ed)?\b|\bwrap\b/i,
  meds:    /\bpainkiller|\bpill|\btablet|\bmedicine\b|\bibuprofen\b|\bswallow/i,
  rest:    /\bcancel|\bmorning off\b|\bher day\b|\bschedule\b|\bdiary\b/i,
  company: /\bhug\b|\bkiss\b|\bplaylist\b|\bmusic\b|\bsong|\btune|\bcat\b|\bcall\b|\bvoice\b|\bheartbeat\b|\bpurr/i,
  food:    /\bfood\b|\beat\b|\bmeal\b|\bhungry\b|\btakeaway\b|\bnoodle|\bdeliver/i,
};

/**
 * The tiles themselves, by name. A far tighter list than SOUNDS_LIKE, because
 * the last rung is SUPPOSED to point at its own shelf, just never to say the
 * words printed on the tile he is looking at.
 */
const TILE_NAMES: Record<Tag, RegExp> = {
  heat:    /\bhot water bottle\b|\brubber pouch\b|\bmake her tea\b|\bcup of tea\b/i,
  warmth:  /\bblanket\b|\bduvet\b|\bquilt\b/i,
  meds:    /\bpainkiller|\bpills?\b|\btablets?\b/i,
  rest:    /\bcancel\b|\bher 9 ?am\b/i,
  company: /\bplaylist\b|\bcall in the cat\b|\blong hug\b|\bkiss goodnight\b/i,
  food:    /\border her food\b|\btakeaway\b/i,
};

/**
 * An order, not a clue. "Press a hot water bottle on her tummy" is the answer
 * read out, and it ends the round the moment he reads it.
 */
const AN_ORDER = /^\s*(send|get|give|press|fill|put|call|clear|order|make|wrap|lay|grab|bring|take|buy|hold|pour|boil|spread|throw|let)\b/i;

/**
 * Keep every rung a clue.
 *
 * Three things can ruin a hint, and the prompt asks for none of them, so this is
 * what happens when it does them anyway:
 *
 *  - the middle rung crosses off a shelf she NEEDS. It is meant to save him a
 *    guess; ruling out an answer about to be marked right costs him one instead.
 *    Held to a stricter rule than the others: it must name no shelf she needs,
 *    not even this need's own.
 *  - the last rung names the tile outright. He has the drawer in front of him,
 *    so that is not a hint, it is the answer.
 *  - any rung tells him what to do. Then there is no guessing left, and the
 *    guessing is the game.
 *
 * A bad rung is swapped for a safe one at the same height, never dropped.
 * Dropping it shortened the ladder, and a short ladder spread over his three
 * guesses showed him the same sentence twice.
 */
function asClues(needs: Need[]): Need[] {
  const wanted = new Set(needs.map(n => n.tag));
  const CROSS_OFF = 1;
  const LAST = MAX_TRIES - 1;

  /**
   * A cross-off she can afford, picked from the shelves she has NOT asked for.
   * No fixed line can be safe on its own: "no arms are long enough to reach in
   * there" is a good clue for a cramp and a terrible one the moment she is
   * lonely too.
   */
  const spare = TAGS.find(t => !wanted.has(t));

  const tooDirect = (hint: string, own: Tag, at: number) => {
    if (AN_ORDER.test(hint)) return true;
    if (at === LAST) return TILE_NAMES[own].test(hint);    // names its own tile
    for (const tag of wanted) {
      if (tag === own && at !== CROSS_OFF) continue;
      if (SOUNDS_LIKE[tag].test(hint)) return true;
    }
    return false;
  };

  return needs.map(need => {
    const bank = HINT_BANK[need.tag];
    const hints = need.hints.map((h, i) => {
      // A stock cross-off cannot know what else she asked for, so it is always
      // re-picked against her real needs. "Kind words have never once loosened
      // a knot" is a fine clue for a cramp and rules out an answer the moment
      // she is lonely too, and no word in it is one a pattern could catch.
      if (i === CROSS_OFF && spare && h === bank[CROSS_OFF]) return RULE_OUT[spare];
      if (!tooDirect(h, need.tag, i)) return h;
      if (i === CROSS_OFF && spare) return RULE_OUT[spare];
      return bank[i] ?? bank[bank.length - 1];
    });
    return { ...need, hints };
  });
}

export function normalise(raw: Record<string, unknown>, intensity: number): Translation {
  const env = String(raw.envelope ?? "swell");
  return {
    envelope: (["swell","stab","grind","throb"].includes(env) ? env : "swell") as Translation["envelope"],
    peak:       clamp(raw.peak, 0.2, 1, intensity / 10),
    pulse_ms:   Math.round(clamp(raw.pulse_ms, 200, 4000, 1400)),
    duration_s: Math.round(clamp(raw.duration_s, 10, 180, 70)),
    label:      String(raw.label ?? "Unnamed sensation"),
    needs:      asClues(normaliseNeeds(raw.needs)),
  };
}

/* ------------------------------------------------------------------ *
 * FALLBACK. Runs when Gemini is down or keyless. Never let the demo die.   *
 * ------------------------------------------------------------------ */
export function sniffNeeds(t: string): Need[] {
  const found: Need[] = [];
  const add = (tag: Tag, label: string) =>
    found.push({ tag, label, hints: HINT_BANK[tag], done: false });
  if (/cold|freez|chill|cramp|clench/.test(t))              add("heat",    "something warm");
  if (/sharp|stab|knife|killing|agony|electric/.test(t))    add("meds",    "the sharp pain");
  if (/tired|exhaust|sleep|can'?t think|fog|drain/.test(t)) add("rest",    "actual rest");
  if (/alone|lonely|miss|sad|cry|low/.test(t))              add("company", "him, nearby");
  if (/heavy|ache|back|hold|hug|curl/.test(t))              add("warmth",  "weight on her");
  if (/hungry|starv|eaten|craving|food/.test(t))            add("food",    "something to eat");
  if (!found.length) add("heat", "something warm");
  return found.slice(0, 3);
}

export function fallback(message: string, intensity: number): Translation {
  const t = message.toLowerCase();
  const base =
    /stab|sharp|knife|electric|shoot|spike/.test(t)
      ? { envelope: "stab"  as const, pulse_ms: 420,  duration_s: 35,  label: "Hot wire, short bursts" }
    : /cold|freez|heavy|exhaust|tired|think|fog/.test(t)
      ? { envelope: "grind" as const, pulse_ms: 2200, duration_s: 110, label: "Leaden cold ache" }
      : { envelope: "swell" as const, pulse_ms: 1600, duration_s: 90,  label: "Slow clenching swell" };

  // through the same guard as the model's answer: the stock cross-off lines are
  // only safe once they have been checked against what she actually needs
  return { ...base, peak: Math.max(0.2, intensity / 10),
           needs: asClues(sniffNeeds(t)), offline: true };
}

/* --------------------------- scoring --------------------------- */
export const unmet = (needs: Need[]) => needs.filter(n => !n.done);

export const score = (needs: Need[], intensity: number) =>
  unmet(needs).length === 0 ? 0 : Math.round(intensity * 10 * unmet(needs).length / needs.length);

/**
 * She said it helped. Tick the need this gift was actually for.
 * If it matches nothing still open, she is still the authority, credit the
 * next open need, so a thoughtful gift is never thrown away.
 */
export function tickOff(needs: Need[], tag: string): Need[] {
  const open = needs.filter(n => !n.done);
  const hit  = open.find(n => n.tag === tag) ?? open[0];
  if (hit) hit.done = true;
  return [...needs];
}

/**
 * The hint he sees: always about the FIRST NEED STILL UNMET, and a clear step
 * further on every single try.
 *
 * One rung per guess he has. If a need comes back with fewer than that, the
 * rungs are spread across what there is rather than stopping partway up, so his
 * last hint is always the clearest one written. Past his last try it stays there.
 */
export function hintFor(needs: Need[], tries: number): string | null {
  const open = unmet(needs);
  if (!open.length) return null;
  const hints = open[0].hints.length ? open[0].hints : HINT_BANK[open[0].tag];
  const last = hints.length - 1;
  const step = MAX_TRIES > 1 ? Math.round((tries * last) / (MAX_TRIES - 1)) : last;
  return hints[Math.min(Math.max(step, 0), last)];
}
