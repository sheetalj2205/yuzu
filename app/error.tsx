"use client";

/**
 * Anything that throws inside a page lands here instead of leaving a white
 * screen. Note this version of Next calls the prop `retry`, not `reset`.
 */
export default function Error({
  error, retry,
}: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="card max-w-sm w-full text-center">
        <div className="text-4xl mb-3">🍊</div>
        <p className="font-round font-black text-lg mb-2">Yuzu tripped over something.</p>
        <p className="text-inkSoft text-sm mb-5 break-words">
          {error?.message || "Something went wrong."}
        </p>
        <button className="btn" onClick={() => retry()}>Try again</button>
        <a href="/" className="block mt-3 text-inkFaint text-xs underline underline-offset-4">
          Back to the start
        </a>
      </div>
    </main>
  );
}
