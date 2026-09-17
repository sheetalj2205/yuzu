"use client";
import { useEffect, useState } from "react";
import RoomScene from "./RoomScene";
import type { Need } from "@/lib/types";
import type { Presence } from "@/lib/presence";

/**
 * HER PHONE. Rule: nothing on this screen that isn't the girl, a box,
 * a slider and one button. When he sends something, that takes over.
 */
const LEVELS = ["","a niggle","noticeable","annoying","bad","properly bad",
                "hard to sit","curled up","rough","crying","can't move"];

export type Gift = { id?: string; emoji: string; name: string; tag: string };

/** He failed. Her turn, each one fires his phone. */
export const HITS = [
  { emoji: "👊", word: "POW!",   pattern: [320, 70, 320] },
  { emoji: "🔨", word: "BONK!",  pattern: [500, 60, 220] },
  { emoji: "🥊", word: "SMACK!", pattern: [180, 50, 180, 50, 180] },
  { emoji: "⚡", word: "ZAP!",   pattern: [90, 40, 90, 40, 90, 40, 420] },
];

export default function HerScreen({
  partnerName, score, needs, gifts, incoming, waiting, failed, hits, won,
  partnerAt, leftCount, onSend, onVerdict, onStrike, onForgive,
}: {
  partnerName: string | null;
  score: number;
  needs: Need[];
  gifts: Gift[];
  incoming: Gift | null;      // what he just sent, awaiting her verdict
  waiting: boolean;           // he has her message, hasn't sent yet
  failed: boolean;            // he burned all 5 tries
  hits: number;               // how many times she has hit back
  won: boolean;               // everything she asked for just landed
  partnerAt: Presence;        // is he actually looking at this?
  leftCount: number;          // how many times he has wandered off this cycle
  onSend: (message: string, intensity: number) => void | Promise<void>;
  onVerdict: (helped: boolean) => void;
  onStrike: (hit: typeof HITS[number]) => void;
  onForgive: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [level, setLevel] = useState(8);
  const [sending, setSending] = useState<"idle" | "sending" | "sent">("idle");
  const sent = needs.length > 0;

  /* Back to a blank box whenever a round ends, so she is never editing the last
     message by mistake. */
  useEffect(() => {
    if (!sent) { setMsg(""); setSending("idle"); }
  }, [sent]);

  const send = async () => {
    const text = msg.trim();
    if (!text || sending !== "idle") return;
    setSending("sending");
    await onSend(text, level);
    setSending("sent");
  };

  return (
    <main className="min-h-dvh px-4 py-5 max-w-md mx-auto flex flex-col gap-4 justify-center">
      {partnerName && !sent && (
        <p className="text-center text-sm text-inkSoft text-balance">
          <b className="text-ink">{partnerName}</b> joined to feel your pain
          and make it better ♡
        </p>
      )}

      <RoomScene score={score} gifts={gifts} angry={failed} fill />

      {/* He can put the phone down. He just can't do it quietly. */}
      {sent && partnerAt !== "here" && (
        <div className="card !py-3 border-pain bg-painSoft text-center pop">
          <p className="font-round font-black text-sm text-pain">
            {partnerAt === "gone"
              ? `${partnerName ?? "He"} closed the app.`
              : `${partnerName ?? "He"} put the phone down.`}
          </p>
          <p className="text-inkSoft text-xs mt-1">
            {leftCount > 1 ? `That's ${leftCount} times. ` : ""}
            You still can't.
          </p>
        </div>
      )}

      {/* ---- everything landed: her moment, before the box comes back ---- */}
      {won ? (
        <div className="card text-center pop">
          <div className="text-5xl mb-2">✿</div>
          <p className="font-round font-black text-xl text-calm mb-1">All of it.</p>
          <p className="text-inkSoft text-sm">
            {partnerName ?? "He"} got there. The rain stopped.
          </p>
        </div>
      ) : incoming ? (
        <div className="card text-center pop">
          <div className="text-6xl mb-2">{incoming.emoji}</div>
          <p className="font-round font-black text-xl mb-1">{incoming.name}</p>
          <p className="text-inkSoft text-sm mb-5">from {partnerName ?? "him"}</p>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-warm" onClick={() => onVerdict(true)}>That helped ♡</button>
            <button className="btn btn-ghost" onClick={() => onVerdict(false)}>Not really</button>
          </div>
        </div>
      ) : failed ? (
        <div className="card text-center">
          <p className="font-round font-black text-lg text-pain mb-1">He ran out of tries.</p>
          <p className="text-inkSoft text-sm">
            {partnerName ?? "He"} tried 5 times and nothing landed. He was guessing.
          </p>
          <p className="font-round font-black text-sm text-pain mt-4 mb-2">Your turn ෆ</p>
          <div className="grid grid-cols-4 gap-2">
            {HITS.map((h) => (
              <button key={h.word} title={h.word} onClick={() => onStrike(h)}
                className="text-2xl bg-painSoft border-2 border-pain rounded-2xl py-2
                           transition active:scale-90 hover:-translate-y-[3px]">
                {h.emoji}
              </button>
            ))}
          </div>
          {hits > 0 && (
            <p className="font-round font-black text-xs text-pain mt-3">
              {hits < 5 ? `${hits} ${hits === 1 ? "hit" : "hits"}. He felt that.`
                        : `${hits} hits. Okay, he has learnt his lesson ♡`}
            </p>
          )}
          <button className="btn btn-ghost mt-3" onClick={onForgive}>
            Alright, he&apos;s forgiven
          </button>
        </div>
      ) : sent ? (
        <div className="card text-center">
          <p className="font-round font-black text-base mb-1">Sent ✓</p>
          <p className="text-inkSoft text-sm">
            {waiting
              ? `${partnerName ?? "He"}'s phone is buzzing. He's trying to work it out.`
              : `${partnerName ?? "He"}'s phone is buzzing.`}
          </p>
        </div>
      ) : (
        /* ---- nothing sent yet: box, slider, button. nothing else. ---- */
        <>
          <textarea
            id="feel"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={3}
            placeholder="how does it feel right now?"
            className="w-full bg-surface border-2 border-line rounded-blob p-4 text-[17px]
                       placeholder:text-inkFaint resize-none"
          />
          <div className="flex items-center gap-3">
            <input
              id="intensity" type="range" min={1} max={10} value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="flex-1 accent-pain h-3"
              aria-label="How bad is it, 1 to 10"
            />
            <span className="font-round font-black text-pain bg-painSoft rounded-full
                             px-3 py-1 text-sm min-w-[8.5rem] text-center">
              {level} · {LEVELS[level]}
            </span>
          </div>
          <button
            className={`btn ${sending === "sent" ? "btn-warm" : ""}`}
            disabled={!msg.trim() || sending !== "idle"}
            onClick={send}
          >
            {sending === "sending" ? "Sending…"
              : sending === "sent" ? "Sent ✓"
              : "Send it to him →"}
          </button>
        </>
      )}
    </main>
  );
}
