"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, signOut } from "@/lib/supabase-client";
import { makeCuddleCode } from "@/lib/items";
import InstallHelp from "@/components/InstallHelp";

/**
 * HER ROOMS, or HIS ONE.
 *
 * She can hold several at once, one per person she has given a code to, and
 * move between them. Each room is its own game: its own cycle, its own hints,
 * its own drawer. Her pain goes to the room she is standing in, not to all of
 * them, so nobody is buzzed for something she is not asking them about.
 *
 * He gets one. He is the one being asked.
 */
type Room = { id: string; code: string; him_id: string | null; partner: string | null };

function Rooms() {
  const router = useRouter();
  const closedOne = useSearchParams().get("closed") === "1";
  const [gender, setGender] = useState<"her" | "him" | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const [closing, setClosing] = useState<string | null>(null);   // room id awaiting a yes
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/"); return null; }
    const { data: p } = await sb.from("profiles").select("gender").eq("id", user.id).single();
    if (!p?.gender) { router.push("/onboarding"); return null; }
    setGender(p.gender);

    const column = p.gender === "her" ? "her_id" : "him_id";
    const { data: mine } = await sb.from("rooms")
      .select("id, code, him_id, her_id")
      .eq(column, user.id)
      .order("created_at", { ascending: true });

    // whoever is on the other side of each one, so she is picking a person
    const otherIds = (mine ?? [])
      .map(r => (p.gender === "her" ? r.him_id : r.her_id))
      .filter((id): id is string => !!id);
    const names = new Map<string, string>();
    if (otherIds.length) {
      const { data: people } = await sb.from("profiles").select("id, name").in("id", otherIds);
      for (const person of people ?? []) names.set(person.id, person.name ?? "Someone");
    }

    const list: Room[] = (mine ?? []).map(r => {
      const otherId = p.gender === "her" ? r.him_id : r.her_id;
      return { id: r.id, code: r.code, him_id: r.him_id,
               partner: otherId ? names.get(otherId) ?? "Someone" : null };
    });
    setRooms(list);
    return { sb, user, gender: p.gender, list };
  }, [router]);

  useEffect(() => {
    (async () => {
      const state = await load();
      if (!state) return;
      // She always lands on the list, even with one room: it is where "leave"
      // and "another room" live. He has nothing to choose, so he goes straight in.
      if (state.gender === "her" && !state.list.length) await makeRoom();
      // the one he joined most recently, not the first he ever joined
      if (state.gender === "him" && state.list.length) {
        router.replace(`/room/${state.list[state.list.length - 1].code}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A fresh code for the next person. Nothing is taken away from the others. */
  const makeRoom = async () => {
    setBusy(true);
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      await sb.from("rooms").insert({ code: makeCuddleCode(), her_id: user.id });
      await load();
    }
    setBusy(false);
  };

  /**
   * Closing one for good. The room goes, and its cycles, gifts and favourites go
   * with it, because the database cascades from here. He is dropped out and the
   * code stops working, so it is asked twice before it happens.
   */
  const close = async (id: string) => {
    setBusy(true);
    await supabase().from("rooms").delete().eq("id", id);
    setClosing(null);
    await load();
    setBusy(false);
  };

  const join = async () => {
    setErr("");
    const sb = supabase();
    // goes through join_room(), he cannot see a room until he is in it
    const { data, error } = await sb.rpc("join_room", { p_code: typed.trim().toUpperCase() });
    if (error) return setErr(error.message);
    const room = Array.isArray(data) ? data[0] : data;
    if (!room) return setErr("No room with that Cuddle Code 🥺");
    router.push(`/room/${room.code}`);
  };

  if (!gender) return null;

  return (
    <main className="min-h-dvh px-5 py-10 flex flex-col items-center">
      <div className="w-full max-w-sm text-center">
        {/* she closed the room out from under him, mid-round */}
        {closedOne && (
          <div className="card border-pain bg-painSoft mb-5">
            <p className="font-round font-black text-sm text-pain">That room is closed.</p>
            <p className="text-inkSoft text-xs mt-1">She ended it. The code will not work now.</p>
          </div>
        )}

        {gender === "her" ? (
          <>
            <p className="font-round font-bold text-sm text-pain mb-1">♡ Your rooms</p>
            <p className="text-inkSoft text-sm mb-5">
              {rooms.length > 1
                ? "Tap one to go in. Your pain only reaches the room you are in."
                : "Send the code to him. Then go in and wait."}
            </p>

            <div className="flex flex-col gap-3 mb-5">
              {rooms.map((r) => (
                <div key={r.id} className="card !p-4 text-left">
                  <button onClick={() => router.push(`/room/${r.code}`)}
                    className="w-full text-left active:translate-y-[2px]">
                    <p className="font-round font-black text-3xl tracking-[.18em] text-pain">
                      {r.code}
                    </p>
                    <p className="text-inkSoft text-xs mt-1">
                      {r.partner ? `${r.partner} is in this one ♡` : "Nobody has joined yet"}
                    </p>
                  </button>

                  {closing === r.id ? (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="text-xs text-ink mb-2">
                        Close this room for good? {r.partner ? `${r.partner} is dropped out, ` : ""}
                        the code stops working, and everything in it goes.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button disabled={busy} onClick={() => close(r.id)}
                          className="btn btn-warm !py-2 !text-sm">Close it</button>
                        <button onClick={() => setClosing(null)}
                          className="btn btn-ghost !py-2 !text-sm">Keep it</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setClosing(r.id)}
                      className="mt-2 text-inkFaint text-xs underline underline-offset-4">
                      Leave this room
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button disabled={busy} onClick={makeRoom} className="btn btn-ghost">
              + Another room
            </button>
          </>
        ) : (
          <>
            <p className="font-round font-bold text-sm text-pain mb-3">♡ Her Cuddle Code</p>
            <input
              value={typed}
              onChange={(e) => { setTyped(e.target.value.toUpperCase()); setErr(""); }}
              maxLength={6}
              placeholder="ABC123"
              className="w-full text-center font-round font-black text-4xl tracking-[.18em]
                         bg-surface border-2 border-line rounded-blob py-5 mb-3 uppercase"
            />
            {err && <p className="text-pain text-sm mb-3">{err}</p>}
            <button className="btn" onClick={join} disabled={typed.length < 6}>Join her room</button>
          </>
        )}

        <InstallHelp />

        <button
          onClick={signOut}
          className="mt-4 text-inkFaint text-xs underline underline-offset-4"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}

export default function RoomGate() {
  return <Suspense><Rooms /></Suspense>;
}
