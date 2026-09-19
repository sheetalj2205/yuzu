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

export default function Watch() {
  const { code } = useParams<{ code: string }>();
  // ?bare=1 drops the chrome, for a clean recording with nothing to crop out
  const bare = useSearchParams().get("bare") === "1";
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
      <div className="flex flex-wrap gap-6 justify-center items-start">
        <Phone label={her ? `${her} · in pain` : "her phone"} bare={bare}>
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

        <Phone label={him ? `${him} · guessing` : "his phone"} bare={bare}>
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
      </div>

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
