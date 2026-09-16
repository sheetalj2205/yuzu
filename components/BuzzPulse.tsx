"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BUZZ_EVENT, canVibrate } from "@/lib/haptics";
import { setSound, soundOn } from "@/lib/sound";

/**
 * What an iPhone gets instead of a vibration.
 *
 * Every buzz pulses the screen edge-to-edge on the same rhythm the motor would
 * have used — red and hard for her cramp, warm and slow for his comfort. On
 * Android this runs alongside the real vibration and just makes it more visible.
 *
 * The sound toggle only appears where something can actually buzz — the room and
 * the demo page. On the login and onboarding screens it would just be clutter.
 */
export default function BuzzPulse() {
  const [flash, setFlash] = useState<null | "pain" | "comfort">(null);
  const [noMotor, setNoMotor] = useState(false);
  const [sound, setSoundState] = useState(false);
  const timers = useRef<number[]>([]);
  const path = usePathname();
  const canBuzzHere = path.startsWith("/room/") || path === "/demo";

  useEffect(() => {
    setNoMotor(!canVibrate());
    setSoundState(soundOn());

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

      {canBuzzHere && (
      <button
        onClick={() => { const next = !sound; setSound(next); setSoundState(next); }}
        aria-pressed={sound}
        className={`fixed right-3 top-3 z-[61] rounded-full border-2 px-3 py-1.5 text-xs
                    font-round font-bold shadow-sm transition
                    ${sound ? "bg-pain border-pain text-white" : "bg-surface border-line text-inkSoft"}`}
        title={noMotor
          ? "Your phone can't vibrate — sound is the next best thing"
          : "Hear the buzz as well as feel it"}
        style={{ top: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
      >
        {sound ? "🔊 sound on" : "🔇 sound off"}
      </button>
      )}
    </>
  );
}
