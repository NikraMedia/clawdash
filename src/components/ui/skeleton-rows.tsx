/**
 * Skeleton loading placeholder for table rows.
 */
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-800">
          <td className="px-4 py-3" colSpan={100}>
            <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Skeleton loading placeholder for generic block layouts (non-table contexts).
 */
export function SkeletonLines({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-lg bg-zinc-800/50"
        />
      ))}
    </div>
  );
}

/**
 * Skeleton card placeholder for grid layouts.
 */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
        >
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-800" />
        </div>
      ))}
    </>
  );
}
