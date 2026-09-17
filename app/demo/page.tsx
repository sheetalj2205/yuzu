"use client";
import { useState } from "react";
import RoomScene from "@/components/RoomScene";
import { buzzPain } from "@/lib/haptics";
import type { Pattern } from "@/lib/types";

/**
 * THE QR MOMENT.
 *
 * No login, no pairing. A whole room scans the code, taps once, and every phone
 * buzzes with the same cramp, then reads what she actually wrote.
 *
 * Why it is safe at scale: every phone sends the SAME message, so after the first
 * one it is all cache. Forty phones, one Gemini call.
 *
 * The tap matters technically too, browsers refuse to vibrate until the user has
 * touched the page.
 */
const HER_WORDS = "A dull fist low in my back, slowly clenching, and I'm freezing";
const INTENSITY = 8;

export default function Demo() {
  const [stage, setStage] = useState<"idle" | "buzzing" | "told">("idle");
  const [label, setLabel] = useState("");

  const feel = async () => {
    setStage("buzzing");
    let pattern: Pattern = {
      envelope: "grind", peak: 0.8, pulse_ms: 2200, duration_s: 110, label: "Leaden cold ache",
    };
    try {
      const res = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: HER_WORDS, intensity: INTENSITY }),
      });
      if (res.ok) pattern = await res.json();
    } catch { /* keep the default pattern, the room still feels it */ }

    setLabel(pattern.label);
    buzzPain(pattern);
    setTimeout(() => buzzPain(pattern), 2600);
    setTimeout(() => setStage("told"), 4200);
  };

  return (
    <main className="min-h-dvh px-4 py-6 max-w-md mx-auto flex flex-col gap-5 justify-center">
      <RoomScene score={stage === "idle" ? 80 : 88} gifts={[]} fill />

      {stage === "idle" && (
        <>
          <h1 className="font-round font-black text-3xl text-center leading-tight text-balance">
            Someone you know<br />feels this right now.
          </h1>
          <button className="btn" onClick={feel}>Tap to feel it →</button>
          <p className="text-center text-inkSoft text-xs">
            Your phone will vibrate. Turn silent mode off.
          </p>
        </>
      )}

      {stage === "buzzing" && (
        <p className="font-round font-black text-2xl text-center text-pain animate-pulse">
          {label || "…"}
        </p>
      )}

      {stage === "told" && (
        <div className="card pop">
          <p className="font-round font-bold text-xs text-pain mb-2">She wrote:</p>
          <p className="font-round font-black text-xl leading-snug">&ldquo;{HER_WORDS}&rdquo;</p>
          <p className="text-inkSoft text-sm mt-4">
            She gets that for five days a month, and still makes the 9am.
          </p>
          <a href="/" className="btn mt-5 block text-center no-underline">See the whole thing ♡</a>
        </div>
      )}
    </main>
  );
}
