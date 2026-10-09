/** Picks a random game other than the current one, preferring games not played recently. */
export function pickNext(
  ids: readonly string[],
  recent: readonly string[],
  r: () => number = Math.random,
  current?: string,
): string {
  const others = ids.filter((id) => id !== current);
  if (!others.length) return ids[0];
  const fresh = others.filter((id) => !recent.includes(id));
  const pool = fresh.length ? fresh : others;
  return pool[Math.floor(r() * pool.length)];
}
