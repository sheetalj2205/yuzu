"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { buzzComfort, buzzPain, buzzStrike, buzzWrong, startBuzzLoop, stopBuzz } from "@/lib/haptics";
import { hintFor, score as scoreOf, tickOff, unmet } from "@/lib/translate";
import { cue } from "@/lib/sound";
import { readPartner, trackVisibility, type Presence } from "@/lib/presence";
import { enablePush, ensurePush, pushState, refreshWorker, type PushState } from "@/lib/push";
import { MAX_TRIES, type Item, type Need, type Pattern } from "@/lib/types";
import HerScreen, { HITS, type Gift } from "@/components/HerScreen";
import HisScreen from "@/components/HisScreen";

type Cycle = {
  id: string; message: string; intensity: number;
  pattern: Pattern; needs: Need[];
  tries: number; revealed: boolean; closed_at: string | null;
};

/**
 * How long after his app last said "open" we still believe it. His app says it
 * every four seconds while on screen, so ten seconds of silence means it has
 * gone, even if the "closed" message never made it out.
 */
const RECENTLY = 10_000;

/** The last attempt to reach his phone: for her eyes, so she never has to guess. */
type Reach = { at: number; state: "watching" | "buzzed" | "unreachable" } | null;

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
  const [meId, setMeId]         = useState<string | null>(null);
  const [myName, setMyName]     = useState<string>("");
  const [partnerAt, setPartnerAt] = useState<Presence>("gone");
  const [leftCount, setLeftCount] = useState(0);
  const [pow, setPow]           = useState<string | null>(null);   // comic hit on HIS screen
  const [love, setLove]         = useState<{ kind: "heart" | "kiss"; n: number } | null>(null);
  const [won, setWon]           = useState(false);   // her moment, before the box comes back
  const [push, setPush]         = useState<PushState>("unsupported");
  /** What happened the last time we tried to reach him, so she is never guessing. */
  const [reach, setReach]       = useState<Reach>(null);
  const stopLoop = useRef<null | (() => void)>(null);
  const cycleRef = useRef<Cycle | null>(null);
  const meRef = useRef<"her" | "him" | null>(null);
  const judged = useRef<Set<string>>(new Set());   // gifts she has already answered
  const finished = useRef<Set<string>>(new Set());  // rounds she has ended herself

  /* Kept fresh ABOVE every effect that reads them. React runs effects in the
     order they are declared, so assigning these lower down meant the gift poll
     saw a null role and the buzz loop saw the previous cycle's pattern. */
  useEffect(() => { cycleRef.current = cycle; }, [cycle]);
  useEffect(() => { meRef.current = me; }, [me]);


  /* ---------------- join the room ---------------- */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return router.push("/");
      const { data: p } = await sb.from("profiles").select("gender, name").eq("id", user.id).single();
      if (!p?.gender) return router.push("/onboarding");
      setMe(p.gender);
      setMeId(user.id);
      setMyName(p.name ?? "Someone");
      setPush(pushState());
      // Safari cancels a subscription and leaves the permission granted, so his
      // phone looks fine while nothing can reach it. Put it back, quietly, and
      // pull down a newer worker if iOS is still running an old one.
      refreshWorker();
      void ensurePush(sb, user.id).then(setPush);

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
  /**
   * Broadcast, not postgres_changes.
   *
   * Realtime evaluates row-level security per subscriber, and the gifts policy
   * is a two-table join, which it silently fails to deliver on. Both people are
   * already authenticated members of this room, so they just tell each other
   * directly. Faster, and it actually arrives.
   */
  const chanRef = useRef<ReturnType<typeof sb.channel> | null>(null);

  /**
   * When his app last said it was open and on screen. 0 means closed.
   *
   * Earlier versions of this were blamed for iPhone notifications failing, and
   * the blame was wrong. The real cause was the push being sent at normal
   * urgency, which lets Apple hold it until the phone is next used, so a closed
   * app never heard anything no matter what this said. With that fixed, "is his
   * app open and on screen" is exactly the right question to ask.
   */
  const partnerOpenRef = useRef(0);

  useEffect(() => {
    if (!roomId || !me || !meId) return;

    const ch = sb.channel(`room:${roomId}`, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });
    chanRef.current = ch;

    ch.on("broadcast", { event: "cycle" }, ({ payload }) => {
      const c = payload?.cycle as Cycle | null;
      // a closed cycle means it is over, clear it, do not resurrect it
      setCycle(c && !c.closed_at ? c : null);
      if (!c || c.closed_at) { setIncoming(null); setGifts([]); setHits(0); }
    });

    ch.on("broadcast", { event: "gift" }, ({ payload }) => {
      if (me !== "her") return;
      setIncoming(payload.gift as Gift);
      cue("arrive");
      buzzComfort();
    });

    ch.on("broadcast", { event: "wrong" }, () => {
      if (me !== "him") return;
      buzzWrong();
      setBuzzing(true);
      setTimeout(() => setBuzzing(false), 900);
    });

    ch.on("broadcast", { event: "heart" }, () => {
      if (me !== "him") return;
      cue("heart"); buzzComfort();
      setLove({ kind: "heart", n: Date.now() });
      setTimeout(() => setLove(null), 2200);
    });

    ch.on("broadcast", { event: "kisses" }, () => {
      if (me !== "him") return;
      cue("kiss"); buzzComfort();
      setLove({ kind: "kiss", n: Date.now() });
      setTimeout(() => setLove(null), 3200);
    });

    ch.on("broadcast", { event: "strike" }, ({ payload }) => {
      if (me !== "him") return;
      const word = String(payload?.word ?? "POW!");
      // the word still picks the sound, but what he SEES is the thing she hit
      // him with: a fist reads as a fist in any language, "BONK" does not
      buzzStrike((payload?.pattern as number[]) ?? [320, 70, 320], word);
      setPow(String(payload?.emoji ?? "👊"));
      setBuzzing(true);
      setTimeout(() => { setBuzzing(false); setPow(null); }, 900);
    });

    ch.on("presence", { event: "sync" }, () => {
      const { presence, name } = readPartner(ch.presenceState(), me);
      setPartnerAt(prev => {
        // he was watching, now he is not, she should know
        if (prev === "here" && presence !== "here") setLeftCount(c => c + 1);
        return presence;
      });
      if (name) setPartner(name);
    });

    ch.on("broadcast", { event: "open" },   () => { partnerOpenRef.current = Date.now(); });
    ch.on("broadcast", { event: "closed" }, () => { partnerOpenRef.current = 0; });

    ch.subscribe(status => {
      if (status !== "SUBSCRIBED") return;
      void ch.track({ role: me, name: myName, state: "here" });
      if (document.visibilityState === "visible") {
        void ch.send({ type: "broadcast", event: "open", payload: {} });
      }
    });

    const untrack = trackVisibility(ch, { role: me, name: myName });

    /**
     * Tell her whether this app is open and on screen.
     *
     * "open" every four seconds while it is, so silence also means closed: a
     * killed app sends nothing at all. "closed" the moment it goes to the
     * background or is swiped away, so she does not have to wait out the
     * silence before his phone is reachable again.
     */
    const onScreen = () => document.visibilityState === "visible";
    const sayOpen   = () => { if (onScreen()) void ch.send({ type: "broadcast", event: "open", payload: {} }); };
    const sayClosed = () => { void ch.send({ type: "broadcast", event: "closed", payload: {} }); };
    const onVisibility = () => (onScreen() ? sayOpen() : sayClosed());

    document.addEventListener("visibilitychange", onVisibility);
    addEventListener("pagehide", sayClosed);
    const beating = setInterval(sayOpen, 4000);

    return () => {
      clearInterval(beating);
      document.removeEventListener("visibilitychange", onVisibility);
      removeEventListener("pagehide", sayClosed);
      untrack(); chanRef.current = null; sb.removeChannel(ch);
    };
  }, [sb, roomId, me, meId, myName]);

  /**
   * Safety net under the broadcast.
   *
   * Broadcast is instant but has no replay, anything sent while he was between
   * page loads, asleep, off signal, or a second before he subscribed is simply
   * gone, and he would sit there looking at a stale screen until he refreshed.
   * So we also ask the database outright, every 1.5s and whenever he returns to
   * the tab. Worst case he waits a second and a half; he never has to refresh.
   */
  useEffect(() => {
    if (!roomId) return;
    let stop = false;
    let ticks = 0;

    const sync = async () => {
      if (stop || document.hidden) return;

      /**
       * She can close a room for good while he is sitting in it. Then this room
       * simply is not there any more, and leaving him staring at a frozen
       * screen would be the one thing Yuzu never does: he always finds out.
       *
       * Every sixth pass, not every one. The cycle underneath needs checking
       * every second and a half; a room being closed is rare enough that ten
       * seconds late costs nobody anything, and it keeps the query off the wire.
       */
      if (++ticks % 6 === 0) {
        const { count } = await sb.from("rooms")
          .select("id", { count: "exact", head: true }).eq("id", roomId);
        if (stop) return;
        if (count === 0) { router.replace("/room?closed=1"); return; }
      }

      const { data } = await sb.from("cycles").select("*").eq("room_id", roomId)
        .is("closed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (stop) return;

      /**
       * Gifts need the same net as cycles: they only ever arrived by broadcast,
       * so if she was on another tab when he sent one she never saw it and he
       * sat waiting on a verdict that could not come.
       *
       * Two things this must not do. It must not pick up her own punches, which
       * are stored as gifts but are not his to be judged. And it must not offer
       * back something she has already answered: the verdict write takes a
       * moment to land, so we remember what she judged and skip it.
       */
      const open = data as Cycle | null;
      if (open && meRef.current === "her") {
        const { data: pending } = await sb.from("gifts")
          .select("id, emoji, name, tag")
          .eq("cycle_id", open.id).eq("verdict", "pending").neq("tag", "strike")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!stop && pending && !judged.current.has(pending.id)) {
          setIncoming(prev => (prev?.id === pending.id ? prev : pending as Gift));
        }
      }

      setCycle(prev => {
        const next = (data as Cycle | null) ?? null;
        if (!next) return null;                 // nothing open: the round is over
        // she ended this one; the closing write may still be in flight, and
        // resurrecting it threw her back to "his phone is buzzing" while she
        // was halfway through typing the next message
        if (finished.current.has(next.id)) return null;
        // only replace when something actually moved, so we do not fight local state
        const moved = !prev || prev.id !== next.id || prev.tries !== next.tries ||
                      prev.revealed !== next.revealed ||
                      JSON.stringify(prev.needs) !== JSON.stringify(next.needs);
        return moved ? next : prev;
      });
    };

    const id = setInterval(sync, 1500);
    document.addEventListener("visibilitychange", sync);
    void sync();
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", sync); };
  }, [sb, roomId, router]);

  /** Tell the other phone something happened. */
  const say = useCallback((event: string, payload: Record<string, unknown>) => {
    void chanRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  /* ---------------- HIS phone buzzes on a loop until she says stop ---------------- */
  /**
   * His phone buzzes until she says every need is met.
   *
   * Keyed on the cycle id and how much is left, NOT on the cycle object: the
   * poll hands back a fresh object on a schedule, and restarting the loop each
   * time fired an extra buzz at him every second and a half for no reason.
   */
  const cycleId = cycle?.closed_at ? null : cycle?.id ?? null;
  const needsLeft = cycle ? unmet(cycle.needs).length : 0;

  useEffect(() => {
    if (me !== "him" || !cycleId || needsLeft === 0) {
      stopLoop.current?.(); setBuzzing(false); return;
    }
    const pattern = cycleRef.current?.pattern;
    if (!pattern) return;
    buzzPain(pattern);
    setBuzzing(true);
    stopLoop.current = startBuzzLoop(pattern, () => unmet(cycleRef.current?.needs ?? []).length > 0);
    return () => { stopLoop.current?.(); };
  }, [me, cycleId, needsLeft]);


  /**
   * Keep HIS screen awake while a cycle is open. A sleeping screen is a hidden
   * page, and a hidden page cannot vibrate, so without this the buzz dies the
   * moment his phone dims, while he is still holding it. Re-acquired after each
   * visibility change, because the OS drops the lock when you switch away.
   */
  useEffect(() => {
    if (me !== "him" || !cycle || cycle.closed_at) return;
    let lock: WakeLockSentinel | null = null;
    let dropped = false;

    const acquire = async () => {
      try { lock = await navigator.wakeLock?.request("screen") ?? null; }
      catch { /* unsupported or denied, nothing to do */ }
    };
    const onVisible = () => { if (!document.hidden && !dropped) void acquire(); };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      dropped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [me, cycle]);
  useEffect(() => () => stopBuzz(), []);

  /**
   * Buzz the other phone through the OS.
   *
   * Always sent. Whether to actually SHOW it is decided by the service worker on
   * his device, which can see whether a window is open and visible right now.
   * This used to be decided here, from presence, and it silently killed every
   * notification on iPhone: iOS does not reliably report a home-screen app as
   * hidden when it is suspended, so presence sat on "here" for a phone that was
   * in his pocket.
   */
  /**
   * Buzz his phone only when his app is not open.
   *
   * Open and on screen, he has already felt it: the in-app buzz and sound went
   * off the moment her message landed, and a banner on top of that is noise.
   * Closed, backgrounded or swiped away, this is the only thing that reaches
   * him, so it goes every time.
   */
  const pushPartner = useCallback(async (title: string, body: string, vibrate: number[], tag: string) => {
    if (!roomId) return;
    if (Date.now() - partnerOpenRef.current < RECENTLY) {
      setReach({ at: Date.now(), state: "watching" });
      return;
    }
    try {
      const res = await fetch("/api/push", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, title, body, vibrate, tag, url: `/room/${code}` }),
      });
      const out = await res.json().catch(() => ({}));
      setReach({ at: Date.now(), state: out?.sent > 0 ? "buzzed" : "unreachable" });
    } catch {
      setReach({ at: Date.now(), state: "unreachable" });
    }
  }, [roomId, code]);

  const turnOnPush = useCallback(async () => {
    if (!meId) return;
    setPush(await enablePush(sb, meId));
  }, [sb, meId]);

  /**
   * THE IPHONE BUZZ.
   *
   * An iPhone cannot be vibrated from a web page at all. Safari has never
   * shipped the Vibration API, on any iOS browser, and there is no flag and no
   * polyfill. The one thing left that actually moves the motor is a
   * notification, so on iPhone the buzz loop IS the notification.
   *
   * Android buzzes every five seconds. Re-pushing that often would be abuse, so
   * this is every twenty, under the same ten minute cap, and it stops the moment
   * she says every need is met. He still cannot end it. Only she can.
   *
   * This is what "he cannot switch it off" actually means on an iPhone. It
   * stays quiet while his app is open, where the in-app buzz is already doing
   * the job, and starts again the moment he leaves it.
   */
  useEffect(() => {
    if (me !== "her" || !cycleId) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 10 * 60_000) return;
      if (unmet(cycleRef.current?.needs ?? []).length === 0) return;
      void pushPartner(
        "She's still hurting",
        "You haven't worked it out yet.",
        [400, 150, 400, 150, 400],
        "yuzu-cramp",
      );
    }, 20_000);
    return () => clearInterval(id);
  }, [me, cycleId, pushPartner]);

  /* ---------------- she sends ---------------- */
  const send = useCallback(async (message: string, intensity: number) => {
    if (!roomId) return;
    const res = await fetch("/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, intensity }),
    });
    const t = await res.json();
    // close anything still open, so two rounds can never run at once
    await sb.from("cycles").update({ closed_at: new Date().toISOString() })
      .eq("room_id", roomId).is("closed_at", null);

    const { data } = await sb.from("cycles").insert({
      room_id: roomId, message, intensity,
      pattern: { envelope: t.envelope, peak: t.peak, pulse_ms: t.pulse_ms,
                 duration_s: t.duration_s, label: t.label },
      needs: t.needs,
    }).select().single();
    if (data) { setCycle(data as Cycle); say("cycle", { cycle: data }); }
    setHits(0);   // his gifts stay in her room across cycles, they are hers now
    void pushPartner(
      "She's in pain",
      `${t.label}. ${t.needs.length} ${t.needs.length === 1 ? "thing" : "things"} she needs.`,
      [400, 150, 400, 150, 400],
      "yuzu-cramp",
    );
  }, [sb, roomId, pushPartner, say]);

  /* ---------------- he sends ---------------- */
  const sendGift = useCallback(async (item: Item) => {
    // out of guesses: the round is hers now, nothing more goes from him to her.
    // Checked here as well as hidden on his screen, so a stale tap cannot slip one in.
    if (!cycle || cycle.revealed) return;
    const { data: row } = await sb.from("gifts").insert({
      cycle_id: cycle.id, emoji: item.emoji, name: item.name, tag: item.tag,
    }).select("id").single();

    // sending costs him nothing, only being wrong does
    say("gift", { gift: { id: row?.id, emoji: item.emoji, name: item.name, tag: item.tag } });
  }, [sb, cycle, say]);

  const addFavourite = useCallback(async (emoji: string, name: string) => {
    if (!roomId) return;
    const { data } = await sb.from("favourites").insert({ room_id: roomId, emoji, name }).select().single();
    if (data) setCustom(c => [...c, { id: data.id, emoji, name, tag: "favourite", custom: true }]);
  }, [sb, roomId]);

  /**
   * He threw out something he added himself. Gone from the drawer at once, so
   * the tile does not sit there through a round trip, then gone from the room.
   * Only the two of them can touch this room's favourites, so there is nobody
   * else's tile he could be deleting.
   */
  const removeFavourite = useCallback(async (id: string) => {
    setCustom(c => c.filter(i => i.id !== id));
    await sb.from("favourites").delete().eq("id", id);
  }, [sb]);

  /* ---------------- she judges ---------------- */
  const verdict = useCallback(async (helped: boolean) => {
    if (!cycle || !incoming) return;
    const gift = incoming;
    setIncoming(null);
    if (gift.id) {
      judged.current.add(gift.id);   // remember it now; the write lands a moment later
      void sb.from("gifts").update({ verdict: helped ? "helped" : "no" }).eq("id", gift.id);
    }

    if (!helped) {
      cue("wrong");
      const tries = cycle.tries + 1;
      const revealed = tries >= MAX_TRIES;
      await sb.from("cycles").update({ tries, revealed }).eq("id", cycle.id);
      const next = { ...cycle, tries, revealed };
      setCycle(next);
      say("cycle", { cycle: next });
      say("wrong", {});
      void pushPartner("Not that.", "She said it didn't help. Try something else.",
                       [200, 80, 200, 80, 200, 80, 400], "yuzu-nope");
      return;
    }

    setGifts(g => [...g, gift]);                       // it stays in her room
    const needs = tickOff(cycle.needs.map(n => ({ ...n })), gift.tag);
    const done  = unmet(needs).length === 0;
    if (done) cue("win");
    const closed_at = done ? new Date().toISOString() : null;
    await sb.from("cycles").update({ needs, closed_at }).eq("id", cycle.id);
    const next = { ...cycle, needs, closed_at };
    if (done) {
      finished.current.add(cycle.id);
      // let her sit in the warm room for a moment before the box comes back
      setWon(true);
      setTimeout(() => { setWon(false); setCycle(null); }, 4500);
    } else {
      setCycle(next);
    }
    say("cycle", { cycle: next });

    // he should feel her saying yes, a heart each time, kisses when it is all done
    say(done ? "kisses" : "heart", { left: unmet(needs).length });
    void pushPartner(
      done ? "All of it ♡" : "That helped ♡",
      done ? "She says you got there." : `${unmet(needs).length} to go.`,
      done ? [120, 90, 120, 90, 320] : [140, 120, 140],
      done ? "yuzu-kiss" : "yuzu-heart",
    );
  }, [sb, cycle, incoming, pushPartner, say]);

  /* he failed, she hits back, and every hit fires his phone */
  const strike = useCallback(async (hit: typeof HITS[number]) => {
    if (!cycle) return;
    setHits(h => h + 1);
    await sb.from("gifts").insert({
      cycle_id: cycle.id, emoji: hit.emoji, name: hit.word, tag: "strike",
    });
    say("strike", { word: hit.word, emoji: hit.emoji, pattern: hit.pattern });
    void pushPartner(`${hit.emoji} ${hit.word}`, "She's had enough.", hit.pattern, "yuzu-strike");
  }, [sb, cycle, pushPartner, say]);

  /** Bin the open round so she can write a new one. */
  const rewrite = useCallback(async () => {
    if (!cycle) return;
    finished.current.add(cycle.id);
    const closed = { ...cycle, closed_at: new Date().toISOString() };
    await sb.from("cycles").update({ closed_at: closed.closed_at }).eq("id", cycle.id);
    setIncoming(null); setPow(null); setCycle(null);
    say("cycle", { cycle: closed });
  }, [sb, cycle, say]);

  const forgive = useCallback(async () => {
    if (!cycle) return;
    finished.current.add(cycle.id);
    const closed = { ...cycle, closed_at: new Date().toISOString() };
    await sb.from("cycles").update({ closed_at: closed.closed_at }).eq("id", cycle.id);
    // wipe it here and on his phone, so neither of us is left in the old round
    setHits(0); setGifts([]); setIncoming(null); setPow(null); setCycle(null);
    say("cycle", { cycle: closed });
  }, [sb, cycle, say]);

  if (!me) return null;

  const needs  = cycle?.needs ?? [];
  const points = cycle ? scoreOf(needs, cycle.intensity) : 0;

  return me === "her" ? (
    <HerScreen
      partnerName={partner}
      score={won || cycle?.closed_at ? 0 : points}
      needs={needs}
      gifts={gifts}
      incoming={incoming}
      waiting={!!cycle && !incoming}
      failed={!!cycle?.revealed && unmet(needs).length > 0}
      hits={hits}
      won={won}
      partnerAt={partnerAt}
      leftCount={leftCount}
      reach={reach?.state ?? null}
      onRooms={() => router.push("/room")}
      onSend={send}
      onVerdict={verdict}
      onStrike={strike}
      onForgive={forgive}
      onRewrite={rewrite}
    />
  ) : (
    <HisScreen
      partnerName={partner}
      roomCode={code}
      hint={cycle && !cycle.revealed ? hintFor(needs, cycle.tries) : null}
      tries={cycle?.tries ?? 0}
      unmetCount={cycle ? unmet(needs).length : 0}
      revealedMessage={cycle?.revealed ? cycle.message : null}
      buzzing={buzzing}
      custom={custom}
      push={push}
      pow={pow}
      love={love?.kind ?? null}
      needCount={needs.length}
      onEnablePush={turnOnPush}
      onSend={sendGift}
      onAddFavourite={addFavourite}
      onRemoveFavourite={removeFavourite}
    />
  );
}
