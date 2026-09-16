"use client";
import type { Pattern } from "./types";

/** HER cramp on HIS phone: short, hard, jabbing. */
export function buzzPain(p: Pattern) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const on  = Math.round(p.pulse_ms * (p.envelope === "stab" ? 0.16 : 0.5) * p.peak);
  const off = Math.max(70, p.pulse_ms - on);
  const pattern: number[] = [];
  for (let i = 0; i < 5; i++) pattern.push(Math.max(45, on), off);
  try { navigator.vibrate(pattern); } catch {}
}

/** HIS comfort on HER phone: slow, long, even — like breathing. */
export function buzzComfort() {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try { navigator.vibrate([180, 520, 220, 520, 260]); } catch {}
}

export function stopBuzz() {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try { navigator.vibrate(0); } catch {}
}

/**
 * His phone does not stop because he tried. It stops when SHE says it stops.
 * Capped at 10 minutes so a real user doesn't rage-quit — a deliberate choice,
 * worth saying out loud in the pitch.
 */
export function startBuzzLoop(p: Pattern, stillUnmet: () => boolean) {
  const started = Date.now();
  const id = setInterval(() => {
    if (!stillUnmet() || Date.now() - started > 10 * 60_000) { clearInterval(id); stopBuzz(); return; }
    buzzPain(p);
  }, 5000);
  return () => { clearInterval(id); stopBuzz(); };
}
