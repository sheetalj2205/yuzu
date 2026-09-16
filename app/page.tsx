"use client";
import { supabase } from "@/lib/supabase-client";

export default function Login() {
  const signIn = async () => {
    await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/onboarding` },
    });
  };

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="text-6xl mb-4">🍊</div>
        <h1 className="font-round font-black text-5xl leading-none mb-3">Yuzu</h1>
        <p className="text-inkSoft text-lg mb-10 leading-snug">
          Pain travels one way.<br />
          <span className="text-comfort font-bold">Comfort travels back.</span>
        </p>
        <button onClick={signIn} className="btn btn-ghost">Continue with Google</button>
      </div>
    </main>
  );
}
