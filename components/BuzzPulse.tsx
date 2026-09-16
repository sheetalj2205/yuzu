"use client";
import { useEffect, useRef, useState } from "react";
import { BUZZ_EVENT, canVibrate, setSound, soundOn } from "@/lib/haptics";

/**
 * What an iPhone gets instead of a vibration.
 *
 * Every buzz pulses the screen edge-to-edge on the same rhythm the motor would
 * have used — red and hard for her cramp, warm and slow for his comfort. On
 * Android this runs alongside the real vibration and just makes it more visible.
 *
 * Also offers the sound toggle, but only where there is no motor: on iPhone the
 * speaker is the only way to actually feel anything.
 */
export default function BuzzPulse() {
  const [flash, setFlash] = useState<null | "pain" | "comfort">(null);
  const [noMotor, setNoMotor] = useState(false);
  const [sound, setSoundState] = useState(false);
  const timers = useRef<number[]>([]);

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
        className="fixed inset-0 z-[60] pointer-events-none transition-opacity duration-75"
        style={{
          opacity: flash ? 1 : 0,
          background: flash === "comfort"
            ? "radial-gradient(circle at 50% 50%, rgba(249,139,160,.42), rgba(249,139,160,0) 72%)"
            : "radial-gradient(circle at 50% 50%, rgba(229,50,110,.5), rgba(229,50,110,0) 70%)",
          boxShadow: flash
            ? `inset 0 0 0 10px ${flash === "comfort" ? "rgba(249,139,160,.75)" : "rgba(229,50,110,.85)"}`
            : "none",
        }}
      />

      {noMotor && (
        <button
          onClick={() => { const next = !sound; setSound(next); setSoundState(next); }}
          className="fixed right-3 top-3 z-[61] rounded-full bg-surface border-2 border-line
                     px-3 py-1.5 text-xs font-round font-bold text-inkSoft shadow-sm"
          title="Your phone can't vibrate — sound is the next best thing"
        >
          {sound ? "🔊 sound on" : "🔇 sound off"}
        </button>
      )}
    </>
  );
}
