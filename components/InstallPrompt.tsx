"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Offer it, then get out of the way. */
const SHOW_FOR_MS = 60_000;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // already installed? never mention it
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS gives no install event — Safari can add to the home screen, but no
    // other iOS browser can, so only tell people who are actually in Safari.
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS|Brave/i.test(ua);
    if (isIos && isSafari) {
      try { if (!localStorage.getItem("yuzu-ios-hint")) setIosHint(true); } catch { setIosHint(true); }
    }

    // say it once, briefly, then stop nagging
    const timer = window.setTimeout(() => setExpired(true), SHOW_FOR_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  if (expired) return null;

  if (deferred) {
    return (
      <button
        onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
        className="fixed left-4 right-4 bottom-4 z-50 max-w-sm mx-auto btn btn-ghost"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        ♡ Add Yuzu to your home screen
      </button>
    );
  }

  if (iosHint) {
    return (
      <button
        onClick={() => {
          setIosHint(false);
          try { localStorage.setItem("yuzu-ios-hint", "1"); } catch {}
        }}
        className="fixed left-4 right-4 bottom-4 z-50 max-w-sm mx-auto card text-center text-sm"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        Tap <b>Share</b> <span aria-hidden>􀈂</span> then <b>Add to Home Screen</b> ♡
        <span className="block text-inkFaint text-xs mt-1">
          Needed for buzzing when Yuzu is closed
        </span>
      </button>
    );
  }
  return null;
}
