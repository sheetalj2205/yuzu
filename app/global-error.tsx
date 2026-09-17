"use client";

/**
 * The last line of defence — this one replaces the whole document, so it cannot
 * use the app's layout, fonts or CSS. Everything here is inline on purpose.
 *
 * It also clears the service worker and its caches before retrying: a white
 * screen on an installed app is almost always a stale shell, and the person
 * staring at it has no way to clear it from a home-screen icon.
 */
export default function GlobalError({
  error, retry,
}: { error: Error & { digest?: string }; retry: () => void }) {
  const hardReset = async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches?.keys?.() ?? [];
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch { /* nothing else to try */ }
    location.replace("/");
  };

  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center",
        background: "#FFEAF3", color: "#5A2440", padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif", textAlign: "center",
      }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍊</div>
          <p style={{ fontWeight: 800, fontSize: 19, margin: "0 0 8px" }}>
            Yuzu could not start.
          </p>
          <p style={{ color: "#A76487", fontSize: 14, margin: "0 0 22px", wordBreak: "break-word" }}>
            {error?.message || "Something went wrong."}
          </p>
          <button onClick={() => retry()} style={{
            width: "100%", padding: "14px", borderRadius: 999, border: "none",
            background: "#E5326E", color: "#fff", fontWeight: 800, fontSize: 15,
          }}>
            Try again
          </button>
          <button onClick={hardReset} style={{
            width: "100%", marginTop: 10, padding: "12px", borderRadius: 999,
            border: "none", background: "#FFD9E9", color: "#A76487", fontWeight: 700, fontSize: 14,
          }}>
            Clear and reload
          </button>
        </div>
      </body>
    </html>
  );
}
