"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[claw-dash] Unhandled error:", error);
  }, [error]);

  const isAuthError =
    error.message?.toLowerCase().includes("auth") ||
    error.message?.toLowerCase().includes("token") ||
    error.message?.toLowerCase().includes("unauthorized");

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
        {isAuthError ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <span className="text-xl text-red-400">!</span>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-red-400">
              Authentication Failed
            </h2>
            <p className="mb-6 text-sm text-zinc-400">
              The gateway token is invalid or expired. Check your{" "}
              <code className="rounded bg-zinc-800 px-1 text-xs">
                .env.local
              </code>{" "}
              file and ensure <code className="rounded bg-zinc-800 px-1 text-xs">OPENCLAW_GATEWAY_TOKEN</code> is set correctly.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <span className="text-xl text-red-400">!</span>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">
              Something went wrong
            </h2>
            <p className="mb-2 text-sm text-zinc-400">
              An unexpected error occurred.
            </p>
            <pre className="mb-6 max-h-24 overflow-auto rounded bg-zinc-950 p-3 text-left text-xs text-red-300">
              {error.message}
            </pre>
          </>
        )}
        <button
          onClick={reset}
          className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-600"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
