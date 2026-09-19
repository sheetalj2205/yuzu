"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function Onboarding() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** What they picked last time, so carrying on is one tap, not a decision. */
  const [last, setLast] = useState<"her" | "him" | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: p } = await sb.from("profiles").select("gender").eq("id", user.id).maybeSingle();
      if (p?.gender === "her" || p?.gender === "him") setLast(p.gender);
    })();
  }, []);

  const pick = async (gender: "her" | "him") => {
    setBusy(true); setErr(null);
    const sb = supabase();
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      return router.push(`/?error=${encodeURIComponent(authErr?.message ?? "Your session did not stick")}`);
    }
    const { error } = await sb.from("profiles").upsert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.email?.split("@")[0],
      avatar_url: user.user_metadata?.avatar_url,
      gender,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    router.push("/room");
  };

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-round font-black text-3xl mb-2 text-center text-balance">
          Which one are you?
        </h1>
        <p className="text-inkSoft text-sm text-center mb-8 text-balance">
          {last
            ? "You can change this any time. Your rooms stay as they are."
            : "You can change this later."}
        </p>
        {err && (
          <div className="card border-pain bg-painSoft mb-4">
            <p className="font-round font-bold text-xs text-pain mb-1">Could not save that</p>
            <p className="text-sm break-words">{err}</p>
          </div>
        )}
        <div className="grid gap-3">
          <button disabled={busy} onClick={() => pick("her")} aria-pressed={last === "her"}
            className={`card text-left flex items-center gap-4 disabled:opacity-50
                        ${last === "her" ? "!border-pain" : ""}`}>
            <span className="text-4xl">🌸</span>
            <span>
              <span className="block font-round font-black text-lg">I&apos;m the one in pain</span>
              <span className="block text-inkSoft text-sm">You&apos;ll get a Cuddle Code to share</span>
              {last === "her" && <span className="block text-pain text-xs font-bold mt-1">Last time</span>}
            </span>
          </button>
          <button disabled={busy} onClick={() => pick("him")} aria-pressed={last === "him"}
            className={`card text-left flex items-center gap-4 disabled:opacity-50
                        ${last === "him" ? "!border-pain" : ""}`}>
            <span className="text-4xl">🧢</span>
            <span>
              <span className="block font-round font-black text-lg">I&apos;m here to help</span>
              <span className="block text-inkSoft text-sm">You&apos;ll need her Cuddle Code</span>
              {last === "him" && <span className="block text-pain text-xs font-bold mt-1">Last time</span>}
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
