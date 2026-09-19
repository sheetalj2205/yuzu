"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ITEMS, FAVE_EMOJI } from "@/lib/items";
import { MAX_TRIES } from "@/lib/types";
import { arrange, loadPrefs, moveTo, savePrefs, type DrawerPrefs } from "@/lib/drawer";
import type { Item } from "@/lib/types";
import type { PushState } from "@/lib/push";

/**
 * HIS PHONE. Rule: he sees a hint and a drawer. Never her words -
 * not until his third wrong guess.
 */
export default function HisScreen({
  partnerName, roomCode, hint, tries, unmetCount, revealedMessage, buzzing, custom,
  push, pow, love, needCount, onSend, onAddFavourite, onRemoveFavourite, onEnablePush,
  onMenu,
}: {
  partnerName: string | null;
  roomCode: string;
  hint: string | null;
  tries: number;
  unmetCount: number;
  revealedMessage: string | null;
  buzzing: boolean;
  custom: Item[];
  push: PushState;
  pow: string | null;          // the emoji she is hitting him with
  love: "heart" | "kiss" | null;   // she said it helped / she said that was all of it
  needCount: number;           // how many things she needs in total
  onEnablePush: () => void;
  onSend: (item: Item) => void;
  onAddFavourite: (emoji: string, name: string) => void;
  onRemoveFavourite: (id: string) => void;
  onMenu: () => void;          // out to sign out, switch role, or another room
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

  /* ------------------------- his arrangement ------------------------- *
   * Rearranging and throwing things out has to be a mode of its own.
   * A drag that is read as a tap sends a gift, and a wrong gift costs him
   * one of only three chances, so tiles simply do not send while he is
   * tidying. Nothing in here is visible to her.
   * ------------------------------------------------------------------ */
  const [prefs, setPrefs] = useState<DrawerPrefs>({ order: [], hidden: [] });
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => { setPrefs(loadPrefs(roomCode)); }, [roomCode]);

  const write = useCallback((next: DrawerPrefs) => {
    setPrefs(next);
    savePrefs(roomCode, next);
  }, [roomCode]);

  const all  = useMemo(() => [...ITEMS, ...custom], [custom]);
  const view = useMemo(() => arrange(all, prefs), [all, prefs]);

  /** Where a tile currently sits, worked out from what he is actually seeing. */
  const ids = useMemo(() => view.map(i => i.id), [view]);

  const reorder = useCallback((from: number, to: number) => {
    const moved = moveTo(ids, from, to);
    if (moved === ids) return;
    // his order also has to remember the things he threw out, or putting them
    // back would drop them at the end of the drawer
    write({ ...prefs, order: [...moved, ...prefs.hidden] });
  }, [ids, prefs, write]);

  /* Pointer events, not HTML5 drag and drop: dragstart never fires on a
     touchscreen, and this has to work on the phone in his hand. */
  const tileUnder = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    const tile = el instanceof Element ? el.closest("[data-tile]") : null;
    return tile?.getAttribute("data-tile") ?? null;
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editing) return;
    // Capturing the pointer retargets everything that follows, including the
    // click, to the tile. Start a drag from the ✕ and the ✕ never hears about
    // its own tap, so a press that starts there is left well alone.
    if ((e.target as Element)?.closest?.("[data-no-drag]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const over = tileUnder(e.clientX, e.clientY);
    if (!over || over === dragId) return;
    reorder(ids.indexOf(dragId), ids.indexOf(over));
  };

  const endDrag = () => setDragId(null);

  /** Same move, for anyone driving this with a keyboard instead of a thumb. */
  const onTileKey = (e: React.KeyboardEvent, id: string) => {
    if (!editing) return;
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1
               : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const at = ids.indexOf(id);
    reorder(at, Math.min(ids.length - 1, Math.max(0, at + step)));
  };

  /**
   * Throwing one out. A favourite he typed himself is really deleted, because
   * it only ever existed because he made it. One of the ten Yuzu ships with is
   * only put away, so "put everything back" can always undo a mis-tap.
   */
  const remove = (it: Item) => {
    if (it.custom) { onRemoveFavourite(it.id); return; }
    write({ order: prefs.order.length ? prefs.order : ids, hidden: [...prefs.hidden, it.id] });
  };

  const restore = () => write({ ...prefs, hidden: [] });

  return (
    <main className={`his-ground relative min-h-dvh px-4 py-5 flex flex-col gap-4
                      ${buzzing ? "shake" : ""}`}>
      <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      {/* His only way out, to sign out or join a different room. Roles are not
          changed from inside a room: that lives on the menu screen, where it
          cannot happen by accident mid-round. Leaving does not stop her buzz
          reaching him: notifications carry on while he is gone. */}
      <button onClick={onMenu}
        className="self-start font-round font-bold text-xs text-inkFaint underline underline-offset-4">
        ‹ menu
      </button>

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
            <span className="pow-emoji">{pow}</span>
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

      {/*
        Out of guesses, the drawer shuts.

        He had his three goes. Now it is her turn, and her turn is hitting him,
        not judging a fourth gift he is still allowed to throw at the problem.
        It opens again when she forgives him and a new round starts.
      */}
      {revealedMessage && (
        <p className="text-center font-round font-bold text-sm text-inkSoft text-balance">
          🔒 Your drawer is shut. She has the last word now.
        </p>
      )}

      {/* drawer */}
      {hint && !revealedMessage && (
        <>
          <div className="flex items-center justify-between -mb-1">
            <p className="font-round font-bold text-xs text-inkFaint">
              {editing ? "Drag to reorder, ✕ to throw out" : "Your drawer"}
            </p>
            <button
              onClick={() => { setEditing(v => !v); setDragId(null); }}
              className="font-round font-bold text-xs text-lav px-2 py-1 rounded-full
                         border-2 border-line active:translate-y-[1px]">
              {editing ? "Done" : "Arrange ✎"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {view.map((it) => {
              const dragging = dragId === it.id;
              return (
                <div
                  key={it.id}
                  data-tile={it.id}
                  className={`relative ${editing ? "touch-none" : ""}
                              ${dragging ? "opacity-50 scale-95" : ""} transition-transform`}
                  onPointerDown={(e) => onPointerDown(e, it.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <button
                    onClick={() => { if (!editing) onSend(it); }}
                    onKeyDown={(e) => onTileKey(e, it.id)}
                    aria-label={editing ? `${it.name}, arrow keys to move` : it.name}
                    className={`card !p-3 w-full h-full flex items-center gap-2 text-left transition
                                ${editing ? "cursor-grab active:cursor-grabbing" : "active:translate-y-[2px]"}
                                ${it.bad ? "border-dashed" : ""}
                                ${it.custom ? "border-lav bg-lavSoft" : ""}`}>
                    <span className="text-2xl">{it.emoji}</span>
                    <span className="font-round font-bold text-sm leading-tight">{it.name}</span>
                  </button>

                  {editing && (
                    <button
                      data-no-drag
                      onClick={() => remove(it)}
                      aria-label={`Throw out ${it.name}`}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-pain text-white
                                 font-round font-black text-sm leading-none grid place-items-center
                                 shadow-md active:translate-y-[1px]">
                      ✕
                    </button>
                  )}
                </div>
              );
            })}

            {!editing && (
              <button onClick={() => setAdding(true)}
                className="card !p-3 border-dashed border-lav text-lav font-round font-bold
                           text-sm flex items-center justify-center gap-2">
                ➕ Add her favourite
              </button>
            )}

            {editing && prefs.hidden.length > 0 && (
              <button onClick={restore}
                className="card !p-3 border-dashed border-lav text-lav font-round font-bold
                           text-sm flex items-center justify-center gap-2">
                ↩︎ Put {prefs.hidden.length} back
              </button>
            )}

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
        </>
      )}
      </div>
    </main>
  );
}
