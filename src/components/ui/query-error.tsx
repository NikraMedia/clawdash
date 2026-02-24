/**
 * Reusable error display for failed tRPC/React Query requests.
 * Shows a compact inline error card with retry button.
 */
export function QueryError({
  error,
  onRetry,
  label,
}: {
  error: { message?: string } | null;
  onRetry?: () => void;
  label?: string;
}) {
  const message = error?.message ?? "Request failed";

  const isAuthError =
    message.toLowerCase().includes("auth") ||
    message.toLowerCase().includes("token") ||
    message.toLowerCase().includes("unauthorized");

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-red-400">!</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-400">
            {isAuthError
              ? "Authentication failed"
              : label
                ? `Failed to load ${label}`
                : "Request failed"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {isAuthError
              ? "Check your gateway token in .env.local"
              : message}
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
