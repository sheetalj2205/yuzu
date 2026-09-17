"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * A permanent way in.
 *
 * The timed card is easy to miss, it only shows for a minute, and on iPhone
 * there is no install button at all, so if you miss it there is nothing left to
 * find. This link always sits on the room screen, and never appears once the
 * app is actually installed.
 */
export default function InstallHelp() {
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(true);   // assume yes until we know
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = navigator.userAgent;
    setIos(/iphone|ipad|ipod/i.test(ua) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) return null;

  return (
    <>
      <button
        onClick={async () => {
          if (deferred) { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }
          else setOpen(true);
        }}
        className="mt-6 text-inkSoft text-xs underline underline-offset-4"
      >
        📲 Install Yuzu on this phone
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center px-5"
             style={{ background: "rgba(90,36,64,.45)" }}
             onClick={() => setOpen(false)}>
          <div className="card max-w-sm w-full text-left" onClick={(e) => e.stopPropagation()}>
            <p className="font-round font-black text-base mb-3">Install Yuzu</p>

            {ios ? (
              <>
                <ol className="text-sm leading-relaxed list-decimal pl-5 space-y-1">
                  <li>Make sure you are in <b>Safari</b>. No other iPhone browser can do this</li>
                  <li>Tap the <b>Share</b> button, the square with an arrow, in the bar at the
                      bottom (or top right on iPad)</li>
                  <li>Scroll down the list and tap <b>Add to Home Screen</b></li>
                  <li>Tap <b>Add</b>, then open Yuzu from your home screen</li>
                </ol>
                <p className="text-inkSoft text-xs mt-3">
                  You will need to sign in once more inside the installed app, iPhone keeps
                  it separate from Safari. After that it stays signed in.
                </p>
                <p className="text-inkSoft text-xs mt-2">
                  On iPhone, notifications only work from the installed app.
                </p>
              </>
            ) : (
              <ol className="text-sm leading-relaxed list-decimal pl-5 space-y-1">
                <li>Open the browser menu, the ⋮ in the corner</li>
                <li>Tap <b>Install app</b> or <b>Add to Home screen</b></li>
              </ol>
            )}

            <button onClick={() => setOpen(false)} className="btn btn-ghost mt-4">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
