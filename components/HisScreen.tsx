"use client";
import { useState } from "react";
import { ITEMS, FAVE_EMOJI } from "@/lib/items";
import { MAX_TRIES } from "@/lib/types";
import type { Item } from "@/lib/types";
import type { PushState } from "@/lib/push";

/**
 * HIS PHONE. Rule: he sees a hint and a drawer. Never her words -
 * not until he has burned all five tries.
 */
export default function HisScreen({
  partnerName, hint, tries, unmetCount, revealedMessage, buzzing, custom,
  push, pow, love, needCount, onSend, onAddFavourite, onEnablePush,
}: {
  partnerName: string | null;
  hint: string | null;
  tries: number;
  unmetCount: number;
  revealedMessage: string | null;
  buzzing: boolean;
  custom: Item[];
  push: PushState;
  pow: string | null;          // "POW!", she is hitting back
  love: "heart" | "kiss" | null;   // she said it helped / she said that was all of it
  needCount: number;           // how many things she needs in total
  onEnablePush: () => void;
  onSend: (item: Item) => void;
  onAddFavourite: (emoji: string, name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState(FAVE_EMOJI[0]);
  const [name, setName] = useState("");
  const [ownEmoji, setOwnEmoji] = useState("");   // whatever he types himself

  /* Take the last character he typed, so a keyboard that inserts a whole
     sequence still leaves one emoji in the box. */
  const takeOne = (raw: string) => [...raw.trim()].slice(-2).join("").slice(0, 4);
  const chosen = ownEmoji || emoji;
  const left = MAX_TRIES - tries;

  return (
    <main className={`his-ground relative min-h-dvh px-4 py-5 flex flex-col gap-4
                      ${buzzing ? "shake" : ""}`}>
      <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      {/* she said yes, he should see it, not just feel it */}
      {love && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[72] overflow-hidden">
          {Array.from({ length: love === "kiss" ? 14 : 6 }, (_, i) => (
            <span key={i} className="love-float"
                  style={{ left: `${6 + (i * 89) % 88}%`,
                           animationDelay: `${(i % 7) * 0.13}s`,
                           fontSize: love === "kiss" ? "30px" : "26px" }}>
              {love === "kiss" ? (i % 2 ? "💋" : "😘") : "♡"}
            </span>
          ))}
        </div>
      )}

      {/* she is hitting back, and he should see it land */}
      {pow && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] burst" />
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[71] grid place-items-center">
            <span className="pow-text">{pow}</span>
          </div>
        </>
      )}
      {!hint && !revealedMessage && (
        <p className="text-center text-sm text-inkSoft text-balance mt-6">
          You&apos;re in <b className="text-ink">{partnerName ?? "her"}</b>&apos;s room.
          Now feel her pain and calm her down ♡
        </p>
      )}

      {/* The one thing that makes this work when he walks away. Asked once,
          at the moment he joins, before there is anything else on screen. */}
      {push === "prompt" && (
        <button onClick={onEnablePush}
          className="card text-center active:translate-y-[2px]">
          <p className="font-round font-black text-sm">Let her reach you 🔔</p>
          <p className="text-inkSoft text-xs mt-1">
            So your phone still buzzes when Yuzu is closed.
          </p>
        </button>
      )}
      {push === "denied" && (
        <p className="text-center text-inkFaint text-xs">
          Notifications are blocked, so she can only reach you while this is open.
        </p>
      )}

      {revealedMessage ? (
        <div className="card pop border-l-[5px] border-l-pain">
          <p className="font-round font-bold text-xs text-pain mb-2">🔓 What she actually wrote:</p>
          <p className="font-round font-black text-xl leading-snug">&ldquo;{revealedMessage}&rdquo;</p>
          <p className="text-inkSoft text-sm mt-3">She&apos;d told you already.</p>
        </div>
      ) : hint ? (
        <>
          <p className="text-center font-round font-bold text-sm text-inkSoft">
            {left > 0
              ? <>You can be wrong <b className="text-ink">{left}</b> more {left === 1 ? "time" : "times"} ♡</>
              : "Out of guesses, and she is still hurting"}
          </p>
          {/* the one place colour is spent on his screen */}
          <div className="card border-l-[5px] border-l-lav">
            <p className="font-round font-bold text-xs text-lav mb-2">
              ✦ she needs {needCount} {needCount === 1 ? "thing" : "things"}. All Yuzu will tell you:
            </p>
            <p className="italic text-lg leading-snug">&ldquo;{hint}&rdquo;</p>
            <p className="font-round font-bold text-xs text-inkFaint mt-3">
              pick something and send it
            </p>
          </div>
          {unmetCount > 0 && (
            <p className="text-center font-round font-bold text-xs text-inkSoft">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-pain align-middle mr-1.5" />
              {unmetCount} {unmetCount === 1 ? "thing" : "things"} still wrong
            </p>
          )}
        </>
      ) : null}

      {/* drawer */}
      {(hint || revealedMessage) && (
        <div className="grid grid-cols-2 gap-2">
          {[...ITEMS, ...custom].map((it) => (
            <button key={it.id} onClick={() => onSend(it)}
              className={`card !p-3 flex items-center gap-2 text-left transition
                          active:translate-y-[2px] ${it.bad ? "border-dashed" : ""}
                          ${it.custom ? "border-lav bg-lavSoft" : ""}`}>
              <span className="text-2xl">{it.emoji}</span>
              <span className="font-round font-bold text-sm leading-tight">{it.name}</span>
            </button>
          ))}

          <button onClick={() => setAdding(true)}
            className="card !p-3 border-dashed border-lav text-lav font-round font-bold
                       text-sm flex items-center justify-center gap-2">
            ➕ Add her favourite
          </button>

          {adding && (
            <div className="col-span-2 card border-dashed border-lav bg-lavSoft">
              <p className="text-inkSoft text-xs mb-2">You know her. Add what actually works.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {FAVE_EMOJI.map((e) => (
                  <button key={e}
                    onClick={() => { setEmoji(e); setOwnEmoji(""); }}
                    aria-pressed={e === chosen}
                    className={`text-xl bg-surface border-2 rounded-2xl px-2 py-1
                                ${e === chosen ? "border-lav scale-110" : "border-line"}`}>
                    {e}
                  </button>
                ))}
                {/* or his own, because the twelve above are never the right one */}
                <input
                  id="own-emoji"
                  value={ownEmoji}
                  onChange={(e) => setOwnEmoji(takeOne(e.target.value))}
                  placeholder="🙂"
                  inputMode="text"
                  aria-label="Or type your own emoji"
                  className={`w-14 text-center bg-surface border-2 rounded-2xl px-1 py-1
                              ${ownEmoji ? "border-lav" : "border-line border-dashed"}`}
                />
              </div>
              <input
                id="fave" value={name} onChange={(e) => setName(e.target.value)} maxLength={34}
                placeholder="her favourite chocolate…"
                className="w-full bg-surface border-2 border-line rounded-full px-4 py-2 text-sm mb-3"
              />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-warm !py-2 !text-sm"
                  onClick={() => {
                    if (!name.trim()) return;
                    onAddFavourite(chosen || "🎁", name.trim());
                    setName(""); setOwnEmoji(""); setAdding(false);
                  }}>
                  Add ♡
                </button>
                <button className="btn btn-ghost !py-2 !text-sm" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </main>
  );
}
