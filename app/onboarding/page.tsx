"use client";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

export default function Onboarding() {
  const router = useRouter();

  const pick = async (gender: "her" | "him") => {
    const sb = supabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return router.push("/");
    await sb.from("profiles").upsert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.email?.split("@")[0],
      avatar_url: user.user_metadata?.avatar_url,
      gender,
    });
    router.push("/room");
  };

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-round font-black text-3xl mb-8 text-center text-balance">
          Which one are you?
        </h1>
        <div className="grid gap-3">
          <button onClick={() => pick("her")} className="card text-left flex items-center gap-4">
            <span className="text-4xl">🌸</span>
            <span>
              <span className="block font-round font-black text-lg">I&apos;m the one in pain</span>
              <span className="block text-inkSoft text-sm">You&apos;ll get a Cuddle Code to share</span>
            </span>
          </button>
          <button onClick={() => pick("him")} className="card text-left flex items-center gap-4">
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
