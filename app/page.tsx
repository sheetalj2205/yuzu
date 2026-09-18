"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

function Login() {
  const params = useSearchParams();
  const router = useRouter();
  const error = params.get("error");
  const [checking, setChecking] = useState(true);

  /**
   * Are they already signed in?
   *
   * This page used to render the Google button no matter what, so a perfectly
   * good session still meant tapping through the account chooser on every
   * launch. The session was never the problem: nothing ever asked for it.
   *
   * Nobody signed in should ever see this screen. Signing out is on the room
   * screen, where they can always reach it.
   */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase().auth.getUser();
      if (!user) return setChecking(false);
      const { data: p } = await supabase()
        .from("profiles").select("gender").eq("id", user.id).maybeSingle();
      router.replace(p?.gender ? "/room" : "/onboarding");
    })();
  }, [router]);

  const signIn = async () => {
    await supabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/onboarding`,
        // always show the account chooser. Without this Google silently reuses
        // whoever signed in last, which makes testing two people on one laptop
        // - and demoing on stage, needlessly painful.
        queryParams: { prompt: "select_account" },
      },
    });
  };

  // straight through, rather than a flash of a button they do not need
  if (checking && !error) return null;

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        {/* the same icon the phone shows on the home screen */}
        <img
          src="/icon-192.png"
          alt=""
          width={104}
          height={104}
          className="mx-auto mb-5 rounded-[26px] shadow-[0_10px_30px_-10px_rgba(229,50,110,.55)]"
        />
        <h1 className="font-round font-black text-5xl leading-none mb-3">Yuzu</h1>
        <p className="text-inkSoft text-lg mb-10 leading-snug">
          Pain travels one way.<br />
          <span className="text-comfort font-bold">Comfort travels back.</span>
        </p>

        {/* never bounce someone back here without telling them why */}
        {error && (
          <div className="card border-pain bg-painSoft mb-5 text-left">
            <p className="font-round font-bold text-xs text-pain mb-1">Sign-in failed</p>
            <p className="text-sm text-ink break-words">{error}</p>
          </div>
        )}

        <button onClick={signIn} className="btn btn-ghost">Continue with Google</button>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
