"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Offered on every visit, then it gets out of the way. */
const SHOW_FOR_MS = 60_000;

/** The iOS share glyph, drawn rather than borrowed, Apple's own symbol font
 *  renders as an empty box anywhere outside Apple's apps. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden
         className="inline-block align-[-3px] mx-[2px]"
         fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // already installed? then there is nothing to offer
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS fires no install event. Only Safari can add to the home screen -
    // Chrome and Firefox on iOS cannot, so do not promise it there.
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS|Brave/i.test(ua);
    if (isIos && isSafari) setIosHint(true);

    const timer = window.setTimeout(() => setHidden(true), SHOW_FOR_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  if (hidden) return null;

  const shell = "fixed left-4 right-4 z-50 max-w-sm mx-auto";
  const sit = { bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" };

  // Android and desktop Chrome: a real one-tap install
  if (deferred) {
    return (
      <div className={shell} style={sit}>
        <button
          onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
          className="btn btn-ghost"
        >
          ♡ Add Yuzu to your home screen
        </button>
      </div>
    );
  }

  // iOS: instructions, not a button. Tapping the card must NOT dismiss it -
  // the whole point is that it stays put while you use Safari's Share menu.
  if (iosHint) {
    return (
      <div className={shell} style={sit}>
        <div className="card relative pr-9">
          <button
            onClick={() => setHidden(true)}
            aria-label="Dismiss"
            className="absolute top-2 right-3 text-inkFaint text-lg leading-none p-1"
          >
            ×
          </button>
          <p className="font-round font-black text-sm text-pain mb-2">Install Yuzu</p>
          <ol className="text-sm leading-relaxed list-decimal pl-4 space-y-0.5">
            <li>Tap <ShareIcon /> at the bottom of Safari</li>
            <li>Scroll and choose <b>Add to Home Screen</b></li>
            <li>Open Yuzu from your home screen</li>
          </ol>
          <p className="text-inkFaint text-xs mt-2">
            Needed on iPhone for buzzing while Yuzu is closed.
          </p>
        </div>
      </div>
    );
  }
  return null;
}
