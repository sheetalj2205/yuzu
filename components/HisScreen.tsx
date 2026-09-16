"use client";
import { useState } from "react";
import { ITEMS, FAVE_EMOJI } from "@/lib/items";
import { MAX_TRIES } from "@/lib/types";
import type { Item } from "@/lib/types";
import type { PushState } from "@/lib/push";

/**
 * HIS PHONE. Rule: he sees a hint and a drawer. Never her words —
 * not until he has burned all five tries.
 */
export default function HisScreen({
  partnerName, hint, tries, unmetCount, revealedMessage, buzzing, custom,
  push, pow, onSend, onAddFavourite, onEnablePush,
}: {
  partnerName: string | null;
  hint: string | null;
  tries: number;
  unmetCount: number;
  revealedMessage: string | null;
  buzzing: boolean;
  custom: Item[];
  push: PushState;
  pow: string | null;          // "POW!" — she is hitting back
  onEnablePush: () => void;
  onSend: (item: Item) => void;
  onAddFavourite: (emoji: string, name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState(FAVE_EMOJI[0]);
  const [name, setName] = useState("");
  const left = MAX_TRIES - tries;

  return (
    <main className={`relative min-h-dvh px-4 py-5 max-w-md mx-auto flex flex-col gap-4
                      ${buzzing ? "shake" : ""}`}>
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
          className="card border-pain bg-painSoft text-center active:translate-y-[2px]">
          <p className="font-round font-black text-sm text-pain">Let her reach you 🔔</p>
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
        <div className="card pop">
          <p className="font-round font-bold text-xs text-pain mb-2">🔓 What she actually wrote:</p>
          <p className="font-round font-black text-xl leading-snug">&ldquo;{revealedMessage}&rdquo;</p>
          <p className="text-inkSoft text-sm mt-3">She&apos;d told you already.</p>
        </div>
      ) : hint ? (
        <>
          <p className="text-center font-round font-black text-lg text-pain">
            {left > 0 ? `${left} ${left === 1 ? "try" : "tries"} left to make her better ♡`
                      : "Out of tries 🥺"}
          </p>
          <div className="card bg-lavSoft border-lav">
            <p className="font-round font-bold text-xs text-lav mb-2">✦ all Yuzu will tell you</p>
            <p className="italic text-base leading-snug">&ldquo;{hint}&rdquo;</p>
            <p className="font-round font-bold text-xs text-lav mt-3">
              → pick something and send it
            </p>
          </div>
          {unmetCount > 0 && (
            <p className="text-center font-round font-bold text-sm text-pain bg-painSoft rounded-full py-2">
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
                  <button key={e} onClick={() => setEmoji(e)} aria-pressed={e === emoji}
                    className={`text-xl bg-surface border-2 rounded-2xl px-2 py-1
                                ${e === emoji ? "border-lav scale-110" : "border-line"}`}>
                    {e}
                  </button>
                ))}
              </div>
              <input
                id="fave" value={name} onChange={(e) => setName(e.target.value)} maxLength={34}
                placeholder="her favourite chocolate…"
                className="w-full bg-surface border-2 border-line rounded-full px-4 py-2 text-sm mb-3"
              />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-warm !py-2 !text-sm"
                  onClick={() => { if (!name.trim()) return;
                    onAddFavourite(emoji, name.trim()); setName(""); setAdding(false); }}>
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
    </main>
  );
}
