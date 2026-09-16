export type Tag = "heat" | "meds" | "rest" | "company" | "warmth";
export const TAGS: Tag[] = ["heat", "meds", "rest", "company", "warmth"];

/** One thing she needs. Carries its OWN hints, so he is always nudged
 *  toward something still unmet — never toward a need she already ticked. */
export type Need = { tag: Tag; label: string; hints: string[]; done: boolean };

export type Pattern = {
  envelope: "swell" | "stab" | "grind" | "throb";
  peak: number;        // 0–1
  pulse_ms: number;    // 200–4000
  duration_s: number;  // 10–180
  label: string;       // "Leaden cold ache"
};

export type Translation = Pattern & {
  needs: Need[];
  offline?: boolean;   // true when the fallback answered
};

export type Item = {
  id: string;
  emoji: string;
  name: string;
  tag: Tag | "bad" | "favourite";
  once?: boolean;
  bad?: boolean;
  custom?: boolean;
};

/** He gets three goes. After that she sees her words revealed to him —
 *  and his phone keeps going until she says every need is met. */
export const MAX_TRIES = 3;
