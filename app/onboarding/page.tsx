"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function Onboarding() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        <h1 className="font-round font-black text-3xl mb-8 text-center text-balance">
          Which one are you?
        </h1>
        {err && (
          <div className="card border-pain bg-painSoft mb-4">
            <p className="font-round font-bold text-xs text-pain mb-1">Could not save that</p>
            <p className="text-sm break-words">{err}</p>
          </div>
        )}
        <div className="grid gap-3">
          <button disabled={busy} onClick={() => pick("her")} className="card text-left flex items-center gap-4 disabled:opacity-50">
            <span className="text-4xl">🌸</span>
            <span>
              <span className="block font-round font-black text-lg">I&apos;m the one in pain</span>
              <span className="block text-inkSoft text-sm">You&apos;ll get a Cuddle Code to share</span>
            </span>
          </button>
          <button disabled={busy} onClick={() => pick("him")} className="card text-left flex items-center gap-4 disabled:opacity-50">
            <span className="text-4xl">🧢</span>
            <span>
              <span className="block font-round font-black text-lg">I&apos;m here to help</span>
              <span className="block text-inkSoft text-sm">You&apos;ll need her Cuddle Code</span>
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
