"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { makeCuddleCode } from "@/lib/items";

export default function RoomGate() {
  const router = useRouter();
  const [gender, setGender] = useState<"her" | "him" | null>(null);
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return router.push("/");
      const { data: p } = await sb.from("profiles").select("gender").eq("id", user.id).single();
      if (!p?.gender) return router.push("/onboarding");
      setGender(p.gender);

      if (p.gender === "her") {
        // reuse her open room, or make one
        const { data: mine } = await sb.from("rooms").select("code").eq("her_id", user.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (mine?.code) return setCode(mine.code);
        const fresh = makeCuddleCode();
        await sb.from("rooms").insert({ code: fresh, her_id: user.id });
        setCode(fresh);
      }
    })();
  }, [router]);

  const join = async () => {
    setErr("");
    const sb = supabase();
    // goes through join_room() — he cannot see a room until he is in it
    const { data, error } = await sb.rpc("join_room", { p_code: typed.trim().toUpperCase() });
    if (error) return setErr(error.message);
    const room = Array.isArray(data) ? data[0] : data;
    if (!room) return setErr("No room with that Cuddle Code 🥺");
    router.push(`/room/${room.code}`);
  };

  if (!gender) return null;

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        {gender === "her" ? (
          <>
            <p className="font-round font-bold text-sm text-pain mb-2">♡ Your Cuddle Code</p>
            <div className="card mb-5">
              <p className="font-round font-black text-5xl tracking-[.18em] text-pain">{code}</p>
            </div>
            <p className="text-inkSoft text-sm mb-6">Send this to him. Then wait right here.</p>
            <button className="btn" onClick={() => router.push(`/room/${code}`)}>
              I&apos;ve sent it →
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
      </div>
    </main>
  );
}
