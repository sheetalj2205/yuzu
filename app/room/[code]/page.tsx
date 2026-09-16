"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { buzzComfort, buzzPain, buzzStrike, startBuzzLoop, stopBuzz } from "@/lib/haptics";
import { hintFor, score as scoreOf, tickOff, unmet } from "@/lib/translate";
import { MAX_TRIES, type Item, type Need, type Pattern } from "@/lib/types";
import HerScreen, { HITS, type Gift } from "@/components/HerScreen";
import HisScreen from "@/components/HisScreen";

type Cycle = {
  id: string; message: string; intensity: number;
  pattern: Pattern; needs: Need[];
  tries: number; revealed: boolean; closed_at: string | null;
};

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const sb = useRef(supabase()).current;

  const [me, setMe]             = useState<"her" | "him" | null>(null);
  const [roomId, setRoomId]     = useState<string | null>(null);
  const [partner, setPartner]   = useState<string | null>(null);
  const [cycle, setCycle]       = useState<Cycle | null>(null);
  const [gifts, setGifts]       = useState<Gift[]>([]);
  const [incoming, setIncoming] = useState<Gift | null>(null);
  const [custom, setCustom]     = useState<Item[]>([]);
  const [buzzing, setBuzzing]   = useState(false);
  const [hits, setHits]         = useState(0);
  const stopLoop = useRef<null | (() => void)>(null);
  const cycleRef = useRef<Cycle | null>(null);


  /* ---------------- join the room ---------------- */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return router.push("/");
      const { data: p } = await sb.from("profiles").select("gender").eq("id", user.id).single();
      if (!p?.gender) return router.push("/onboarding");
      setMe(p.gender);

      const { data: room } = await sb.from("rooms").select("id, her_id, him_id").eq("code", code).single();
      if (!room) return router.push("/room");
      setRoomId(room.id);

      const otherId = p.gender === "her" ? room.him_id : room.her_id;
      if (otherId) {
        const { data: other } = await sb.from("profiles").select("name").eq("id", otherId).single();
        setPartner(other?.name ?? null);
      }

      const { data: open } = await sb.from("cycles").select("*").eq("room_id", room.id)
        .is("closed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (open) setCycle(open as Cycle);

      const { data: faves } = await sb.from("favourites").select("*").eq("room_id", room.id);
      setCustom((faves ?? []).map(f => ({
        id: f.id, emoji: f.emoji, name: f.name, tag: "favourite" as const, custom: true,
      })));
    })();
  }, [sb, code, router]);

  /* ---------------- live sync between the two phones ---------------- */
  useEffect(() => {
    if (!roomId) return;
    const ch = sb.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cycles", filter: `room_id=eq.${roomId}` },
        ({ new: row }) => setCycle(row as Cycle))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts" },
        ({ new: row }) => {
          const g = row as unknown as Gift & { verdict: string };
          if (g.tag === "strike") {                                // she is hitting back
            if (me === "him") {
              const hit = HITS.find(h => h.word === g.name);
              buzzStrike(hit?.pattern ?? [320, 70, 320]);
              setBuzzing(true);
              setTimeout(() => setBuzzing(false), 800);
            }
            return;
          }
          if (me === "her") { setIncoming(g); buzzComfort(); }   // HER phone: soft, warm
        })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, roomId, me]);

  /* ---------------- HIS phone buzzes on a loop until she says stop ---------------- */
  useEffect(() => {
    if (me !== "him" || !cycle || cycle.closed_at) { stopLoop.current?.(); setBuzzing(false); return; }
    const left = () => unmet(cycle.needs).length > 0;
    if (!left()) { stopLoop.current?.(); setBuzzing(false); return; }
    buzzPain(cycle.pattern);
    setBuzzing(true);
    stopLoop.current = startBuzzLoop(cycle.pattern, left);
    return () => { stopLoop.current?.(); };
  }, [me, cycle]);

  useEffect(() => { cycleRef.current = cycle; }, [cycle]);
  useEffect(() => () => stopBuzz(), []);

  /* ---------------- she sends ---------------- */
  const send = useCallback(async (message: string, intensity: number) => {
    if (!roomId) return;
    const res = await fetch("/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, intensity }),
    });
    const t = await res.json();
    const { data } = await sb.from("cycles").insert({
      room_id: roomId, message, intensity,
      pattern: { envelope: t.envelope, peak: t.peak, pulse_ms: t.pulse_ms,
                 duration_s: t.duration_s, label: t.label },
      needs: t.needs,
    }).select().single();
    if (data) setCycle(data as Cycle);
    setGifts([]);
  }, [sb, roomId]);

  /* ---------------- he sends ---------------- */
  const sendGift = useCallback(async (item: Item) => {
    if (!cycle) return;
    await sb.from("gifts").insert({
      cycle_id: cycle.id, emoji: item.emoji, name: item.name, tag: item.tag,
    });
    const tries = cycle.tries + 1;
    const revealed = tries >= MAX_TRIES;
    await sb.from("cycles").update({ tries, revealed }).eq("id", cycle.id);
    setCycle({ ...cycle, tries, revealed });
  }, [sb, cycle]);

  const addFavourite = useCallback(async (emoji: string, name: string) => {
    if (!roomId) return;
    const { data } = await sb.from("favourites").insert({ room_id: roomId, emoji, name }).select().single();
    if (data) setCustom(c => [...c, { id: data.id, emoji, name, tag: "favourite", custom: true }]);
  }, [sb, roomId]);

  /* ---------------- she judges ---------------- */
  const verdict = useCallback(async (helped: boolean) => {
    if (!cycle || !incoming) return;
    const gift = incoming;
    setIncoming(null);

    if (!helped) {
      // "not really" → his phone goes off again, right now
      await sb.from("cycles").update({ tries: cycle.tries }).eq("id", cycle.id);
      setCycle({ ...cycle });
      return;
    }

    setGifts(g => [...g, gift]);                       // it stays in her room
    const needs = tickOff(cycle.needs.map(n => ({ ...n })), gift.tag);
    const done  = unmet(needs).length === 0;
    await sb.from("cycles").update({
      needs, closed_at: done ? new Date().toISOString() : null,
    }).eq("id", cycle.id);
    setCycle({ ...cycle, needs, closed_at: done ? new Date().toISOString() : null });
  }, [sb, cycle, incoming]);

  /* he failed — she hits back, and every hit fires his phone */
  const strike = useCallback(async (hit: typeof HITS[number]) => {
    if (!cycle) return;
    setHits(h => h + 1);
    await sb.from("gifts").insert({
      cycle_id: cycle.id, emoji: hit.emoji, name: hit.word, tag: "strike",
    });
  }, [sb, cycle]);

  const forgive = useCallback(async () => {
    if (!cycle) return;
    setHits(0);
    await sb.from("cycles").update({ closed_at: new Date().toISOString() }).eq("id", cycle.id);
    setCycle(null);
  }, [sb, cycle]);

  if (!me) return null;

  const needs  = cycle?.needs ?? [];
  const points = cycle ? scoreOf(needs, cycle.intensity) : 0;

  return me === "her" ? (
    <HerScreen
      partnerName={partner}
      score={cycle?.closed_at ? 0 : points}
      needs={needs}
      gifts={gifts}
      incoming={incoming}
      waiting={!!cycle && !incoming}
      failed={!!cycle?.revealed && unmet(needs).length > 0}
      hits={hits}
      onSend={send}
      onVerdict={verdict}
      onStrike={strike}
      onForgive={forgive}
    />
  ) : (
    <HisScreen
      partnerName={partner}
      hint={cycle && !cycle.revealed ? hintFor(needs, cycle.tries) : null}
      tries={cycle?.tries ?? 0}
      unmetCount={cycle ? unmet(needs).length : 0}
      revealedMessage={cycle?.revealed ? cycle.message : null}
      buzzing={buzzing}
      custom={custom}
      onSend={sendGift}
      onAddFavourite={addFavourite}
    />
  );
}
