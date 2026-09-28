/**
 * Tiny per-instance cache for an async read: at most one call per `ttlMs`,
 * concurrent callers share the in-flight promise, and `invalidate()` makes
 * the next call read fresh (a read that started before the invalidation is
 * never stored). Failed reads are not cached.
 */
export function createTtlMemo<T>(
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
) {
  let value: { at: number; data: T } | null = null;
  let inflight: Promise<T> | null = null;
  let generation = 0;

  async function get(): Promise<T> {
    if (value && now() - value.at < ttlMs) return value.data;
    if (inflight) return inflight;
    const gen = generation;
    const startedAt = now();
    const p = load().then(
      (data) => {
        if (gen === generation) value = { at: startedAt, data };
        return data;
      },
      (err) => {
        throw err;
      },
    );
    inflight = p;
    const clear = () => {
      if (inflight === p) inflight = null;
    };
    p.then(clear, clear);
    return p;
  }

  function invalidate() {
    generation += 1;
    value = null;
    inflight = null;
  }

  return { get, invalidate };
}
