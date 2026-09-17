"use client";
import { useEffect, useRef, useState } from "react";
import { BUZZ_EVENT } from "@/lib/haptics";

/**
 * What an iPhone gets instead of a vibration.
 *
 * Every buzz pulses the screen edge-to-edge on the same rhythm the motor would
 * have used, red and hard for her cramp, warm and slow for his comfort. On
 * Android this runs alongside the real vibration and just makes it more visible.
 *
 * Nothing to tap, nothing to read, it is invisible until a buzz fires.
 */
export default function BuzzPulse() {
  const [flash, setFlash] = useState<null | "pain" | "comfort">(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {

    const onBuzz = (e: Event) => {
      const { pattern, kind } = (e as CustomEvent<{ pattern: number[]; kind: "pain" | "comfort" }>).detail;
      timers.current.forEach(clearTimeout);
      timers.current = [];

      let at = 0;
      for (let i = 0; i < pattern.length; i += 2) {
        const on = pattern[i], off = pattern[i + 1] ?? 0;
        timers.current.push(window.setTimeout(() => setFlash(kind), at));
        timers.current.push(window.setTimeout(() => setFlash(null), at + on));
        at += on + off;
      }
    };

    window.addEventListener(BUZZ_EVENT, onBuzz);
    return () => {
      window.removeEventListener(BUZZ_EVENT, onBuzz);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-[60] pointer-events-none transition-opacity duration-150"
        style={{
          opacity: flash ? 1 : 0,
          // a glow at the edges, not a strobe across the whole screen
          background: "transparent",
          boxShadow: flash
            ? `inset 0 0 90px 12px ${flash === "comfort"
                ? "rgba(249,139,160,.45)" : "rgba(229,50,110,.5)"}`
            : "none",
        }}
      />

          </>
  );
}
