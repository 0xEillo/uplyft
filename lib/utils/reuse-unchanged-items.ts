/**
 * Returns `next`, but with every item that is deeply equal to the item with
 * the same id in `prev` replaced by that previous object.
 *
 * Feed refreshes (pull-to-refresh, tab re-focus) refetch the first page and
 * get brand-new objects for workouts that did not change. Keeping the old
 * references lets memoized cards skip re-rendering. If nothing changed at all
 * the previous array itself is returned, so a setState becomes a no-op.
 */
export function reuseUnchangedItems<T extends { id: string }>(
  prev: readonly T[],
  next: T[],
): T[] {
  if (prev.length === 0 || next.length === 0) return next

  const prevById = new Map<string, T>()
  for (const item of prev) prevById.set(item.id, item)

  let changed = next.length !== prev.length
  const result = next.map((item, index) => {
    const previous = prevById.get(item.id)
    const reused =
      previous !== undefined && isJsonEqual(previous, item) ? previous : item
    if (reused !== prev[index]) changed = true
    return reused
  })

  return changed ? result : (prev as T[])
}

function isJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}
