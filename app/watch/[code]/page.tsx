"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import HerScreen, { type Gift } from "@/components/HerScreen";
import HisScreen from "@/components/HisScreen";
import { hintFor, score as scoreOf, unmet } from "@/lib/translate";
import type { Item, Need } from "@/lib/types";

/**
 * THE SPECTATOR VIEW, for the stage and for the camera.
 *
 * Both phones, side by side, on one laptop screen. Nothing here is simulated:
 * it reads the same live room the two of them are actually playing in, so what
 * the audience watches is the real round happening in real time on real phones.
 *
 * Why this exists. Filming two phones on a table means glare, shaky hands and a
 * camera that cannot see either screen properly, and the live demo means the
 * room squinting at somebody's palm. Point a screen recorder at this instead.
 *
 * It is READ ONLY, deliberately. Every control is inert and nothing here can
 * send, judge or guess. The game belongs to the two people holding the phones,
 * and a presenter leaning on the laptop must not be able to play it for them.
 */
type Cycle = {
  id: string; message: string; intensity: number;
  needs: Need[]; tries: number; revealed: boolean; closed_at: string | null;
};

const noop = () => {};

/**
 * The captions for the landscape walkthrough, in the order they are spoken.
 *
 * They are here rather than typed live because a presenter cannot narrate and
 * think of a heading at the same time, and a recording cannot be un-mistyped.
 * → and ← move through them, so the person recording only has to press one key.
 */
const CHAPTERS = [
  { over: "the problem",   title: "She is in Pune. He is in Berlin." },
  { over: "her phone",     title: "She writes what it actually feels like." },
  { over: "how bad",       title: "One to ten. Tonight it is an eight." },
  { over: "his phone",     title: "His phone buzzes. Her words do not arrive." },
  { over: "the clue",      title: "Yuzu turns her pain into one clue." },
  { over: "the drawer",    title: "Ten things he can send. Three guesses." },
  { over: "wrong",         title: "Wrong. The clue changes, it does not repeat." },
  { over: "right",         title: "That one landed." },
  { over: "out of tries",  title: "Three wrong, and her message unlocks." },
  { over: "her turn",      title: "Now she gets to hit back. His phone feels it." },
  { over: "why",           title: "Women describe their pain and are asked to prove it." },
];

export default function Watch() {
  const { code } = useParams<{ code: string }>();
  const params = useSearchParams();
  // ?bare=1 drops the chrome, for a clean recording with nothing to crop out
  const bare = params.get("bare") === "1";
  // ?stage=1 is the landscape one, for a walkthrough video: 16:9, both phones,
  // and a caption that says what the audience is looking at.
  const stage = params.get("stage") === "1";
  const sb = useRef(supabase()).current;

  const [roomId, setRoomId]   = useState<string | null>(null);
  const [her, setHer]         = useState<string | null>(null);
  const [him, setHim]         = useState<string | null>(null);
  const [cycle, setCycle]     = useState<Cycle | null>(null);
  const [gifts, setGifts]     = useState<Gift[]>([]);
  const [pending, setPending] = useState<Gift | null>(null);
  const [custom, setCustom]   = useState<Item[]>([]);
  const [error, setError]     = useState("");

  useEffect(() => {
    (async () => {
      /**
       * The laptop has to be signed in as one of them.
       *
       * Row-level security refuses to show a room to somebody who merely knows
       * the code, which is exactly right: a Cuddle Code is not a public ticket
       * to watch two people's evening. So this is not a hole to work around,
       * it is the reason the screen is safe to put on a projector.
       */
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        setError("Sign in on this device as either of them, then come back.");
        return;
      }

      const { data: room } = await sb.from("rooms")
        .select("id, her_id, him_id").eq("code", code).maybeSingle();
      if (!room) { setError("No room with that code, or it is not one of yours."); return; }
      setRoomId(room.id);

      const ids = [room.her_id, room.him_id].filter(Boolean) as string[];
      const { data: people } = await sb.from("profiles").select("id, name").in("id", ids);
      const name = (id: string | null) =>
        people?.find(p => p.id === id)?.name ?? null;
      setHer(name(room.her_id));
      setHim(name(room.him_id));
    })();
  }, [sb, code]);

  /**
   * Poll, do not subscribe.
   *
   * A spectator has nothing to say, so it never joins the broadcast channel:
   * joining would make the laptop show up as a third person in the room and
   * start answering the heartbeat, which decides whether his phone gets buzzed.
   * A laptop on a stage must not be able to stop his phone ringing.
   */
  useEffect(() => {
    if (!roomId) return;
    let stop = false;

    const sync = async () => {
      if (stop) return;
      const { data } = await sb.from("cycles").select("*").eq("room_id", roomId)
        .is("closed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (stop) return;
      const open = data as Cycle | null;
      setCycle(open);

      if (!open) { setGifts([]); setPending(null); return; }

      const { data: all } = await sb.from("gifts")
        .select("id, emoji, name, tag, verdict")
        .eq("cycle_id", open.id).order("created_at", { ascending: true });
      if (stop) return;
      const list = all ?? [];
      setGifts(list.filter(g => g.tag !== "strike").map(g => ({
        id: g.id, emoji: g.emoji, name: g.name, tag: g.tag,
      })));
      const waiting = [...list].reverse()
        .find(g => g.verdict === "pending" && g.tag !== "strike");
      setPending(waiting
        ? { id: waiting.id, emoji: waiting.emoji, name: waiting.name, tag: waiting.tag }
        : null);
    };

    // his drawer, so the favourites he added for her show up on stage too
    void sb.from("favourites").select("*").eq("room_id", roomId).then(({ data }) => {
      if (!stop) setCustom((data ?? []).map(f => ({
        id: f.id, emoji: f.emoji, name: f.name, tag: "favourite" as const, custom: true,
      })));
    });

    const id = setInterval(sync, 1000);   // a second is plenty, and it films smoothly
    void sync();
    return () => { stop = true; clearInterval(id); };
  }, [sb, roomId]);

  /* ---- the landscape stage, and the one key that drives it ---- */
  const [chapter, setChapter] = useState(0);
  useEffect(() => {
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ")
        setChapter(c => Math.min(CHAPTERS.length - 1, c + 1));
      if (e.key === "ArrowLeft")
        setChapter(c => Math.max(0, c - 1));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [stage]);

  /**
   * The stage is drawn at a fixed 1600x900 and then scaled to whatever window
   * it is in. Without this the framing depends on the size of the browser
   * window, and a video recorded on one laptop looks wrong on another.
   */
  const [fit, setFit] = useState(1);
  useEffect(() => {
    if (!stage) return;
    const measure = () => setFit(Math.min(innerWidth / 1600, innerHeight / 900));
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [stage]);

  if (error) {
    return (
      <main className="min-h-dvh grid place-items-center px-6">
        <div className="card max-w-sm text-center">
          <p className="font-round font-black text-pain text-lg mb-2">Nothing to watch</p>
          <p className="text-inkSoft text-sm">{error}</p>
        </div>
      </main>
    );
  }

  const needs   = cycle?.needs ?? [];
  const left    = unmet(needs).length;
  const points  = cycle ? scoreOf(needs, cycle.intensity) : 0;
  const revealed = !!cycle?.revealed;

  const phones = (
    <>
      <Phone label={her ? `${her} · in pain` : "her phone"} bare={bare || stage}>
        <HerScreen
          partnerName={him}
          score={points}
          needs={needs}
          gifts={gifts}
          incoming={pending}
          waiting={!!cycle && !pending}
          failed={revealed && left > 0}
          hits={0}
          won={false}
          partnerAt="here"
          leftCount={0}
          reach={null}
          onRooms={noop} onSend={noop} onVerdict={noop}
          onStrike={noop} onForgive={noop} onRewrite={noop}
        />
      </Phone>

      <Phone label={him ? `${him} · guessing` : "his phone"} bare={bare || stage}>
        <HisScreen
          partnerName={her}
          roomCode={`watch-${code}`}   // never touches his own drawer arrangement
          hint={cycle && !revealed ? hintFor(needs, cycle.tries) : null}
          tries={cycle?.tries ?? 0}
          unmetCount={left}
          revealedMessage={revealed ? cycle?.message ?? null : null}
          buzzing={false}
          custom={custom}
          push="ready"
          pow={null}
          love={null}
          needCount={needs.length}
          onEnablePush={noop} onSend={noop}
          onAddFavourite={noop} onRemoveFavourite={noop} onMenu={noop}
        />
      </Phone>
    </>
  );

  /**
   * LANDSCAPE. One 16:9 frame holding both phones and a caption, so a screen
   * recorder pointed at this window produces a finished YouTube shot with
   * nothing to crop, nothing to arrange and nothing to caption afterwards.
   */
  if (stage) {
    const ch = CHAPTERS[chapter];
    return (
      <main className="min-h-dvh overflow-hidden grid place-items-center bg-paper">
        <div
          style={{ width: 1600, height: 900, transform: `scale(${fit})` }}
          className="relative shrink-0 grid grid-cols-[1fr_auto] items-center gap-16 px-20"
        >
          <div>
            <p className="font-round font-black text-sm tracking-[.24em] text-lav uppercase mb-5">
              {ch.over}
            </p>
            <h2 className="font-round font-black text-[62px] leading-[1.08] text-balance">
              {ch.title}
            </h2>

            {/* where we are, so a viewer knows the video is going somewhere */}
            <div className="flex gap-2 mt-10">
              {CHAPTERS.map((_, i) => (
                <span key={i}
                  className={`h-2 rounded-full transition-all
                              ${i === chapter ? "w-10 bg-pain" : "w-2 bg-line"}`} />
              ))}
            </div>

            <p className="font-round font-bold text-xs text-inkFaint mt-10">
              yuzu-vert.vercel.app · room {code}
            </p>
          </div>

          <div className="flex gap-8 items-start">{phones}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 py-6">
      {!bare && (
        <header className="text-center mb-5">
          <p className="font-round font-black text-2xl text-pain tracking-[.2em]">{code}</p>
          <p className="text-inkSoft text-xs mt-1">
            live · {her ?? "her"} and {him ?? "him"} ·
            {cycle ? ` ${left} of ${needs.length} still wrong` : " waiting for her"}
          </p>
        </header>
      )}

      {/* Two phones. Each screen is the real component the real phone renders,
          so there is no second version of the UI to drift out of date. */}
      <div className="flex flex-wrap gap-6 justify-center items-start">{phones}</div>

      {!bare && (
        <p className="text-center text-inkFaint text-[11px] mt-6">
          Watching only. Nothing on this screen can send, judge or guess.
        </p>
      )}
    </main>
  );
}

/** A phone-shaped window. pointer-events-none is what makes it a window. */
function Phone({ label, bare, children }: {
  label: string; bare: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[375px] h-[720px] rounded-[42px] border-[10px] border-[#5A2440]
                      overflow-hidden shadow-[0_30px_60px_-20px_rgba(90,36,64,.55)] bg-surface">
        <div className="w-full h-full overflow-y-auto pointer-events-none select-none">
          {children}
        </div>
      </div>
      {!bare && (
        <p className="font-round font-bold text-xs text-inkSoft">{label}</p>
      )}
    </div>
  );
}
