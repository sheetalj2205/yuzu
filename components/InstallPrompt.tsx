"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Registers the service worker, and offers "Add to home screen" on Android.
 * iOS gives no install event, so there we just say how (Share → Add to Home Screen).
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos && !standalone) {
      try { if (!localStorage.getItem("yuzu-ios-hint")) setIosHint(true); } catch {}
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismissIos = () => {
    setIosHint(false);
    try { localStorage.setItem("yuzu-ios-hint", "1"); } catch {}
  };

  if (deferred) {
    return (
      <button
        onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
        className="fixed left-4 right-4 bottom-4 z-50 max-w-sm mx-auto btn btn-ghost"
      >
        ♡ Add Yuzu to your home screen
      </button>
    );
  }

  if (iosHint) {
    return (
      <button onClick={dismissIos}
        className="fixed left-4 right-4 bottom-4 z-50 max-w-sm mx-auto card text-center text-sm">
        Tap <b>Share</b> → <b>Add to Home Screen</b> to install Yuzu ♡
      </button>
    );
  }
  return null;
}
