export function heartMapFromIds(ids: readonly string[]): Record<string, true> {
  const next: Record<string, true> = {};
  for (const id of ids) {
    const key = id.trim();
    if (key) next[key] = true;
  }
  return next;
}

export function idsFromHeartMap(ids: Record<string, true>): string[] {
  return Object.keys(ids);
}

/** Remote wins order; local hearts are kept so an anonymous save is not lost. */
export function mergeFavoriteIds(
  local: readonly string[],
  remote: readonly string[],
  known?: ReadonlySet<string>,
): string[] {
  const next = new Set<string>();
  for (const id of [...remote, ...local]) {
    const key = id.trim();
    if (!key) continue;
    if (known && !known.has(key)) continue;
    next.add(key);
  }
  return [...next];
}

export function isSignedInForSaves(input: {
  authEnabled: boolean;
  userId?: string | null;
  isDevFallback?: boolean;
}): boolean {
  return Boolean(input.authEnabled && input.userId && !input.isDevFallback);
}
