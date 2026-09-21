export const STREAK_KEY = "trismegistus-listen-streak";
export const LISTEN_STREAK_SECONDS = 30;
export const STREAK_KEEP_DAYS = 90;

export type StreakRecord = {
  days: string[];
  count: number;
};

/** Add `days` to a `YYYY-MM-DD` civil date (UTC arithmetic, no DST holes). */
export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function streakCount(days: readonly string[], today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addCalendarDays(today, -1);
  if (!set.has(cursor)) return 0;
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return n;
}

export function markListenDay(
  days: readonly string[],
  today: string,
): StreakRecord {
  const unique = new Set(days);
  unique.add(today);
  const next = [...unique].sort();
  const kept = next.slice(-STREAK_KEEP_DAYS);
  return { days: kept, count: streakCount(kept, today) };
}

export function shouldCreditListen(input: {
  trackId: string;
  dailyId: string;
  elapsed: number;
  threshold?: number;
}): boolean {
  return (
    input.trackId === input.dailyId &&
    input.elapsed >= (input.threshold ?? LISTEN_STREAK_SECONDS)
  );
}

export function parseStreakRecord(raw: string | null): StreakRecord {
  if (!raw) return { days: [], count: 0 };
  try {
    const parsed = JSON.parse(raw) as { days?: unknown };
    const days = Array.isArray(parsed.days)
      ? parsed.days.filter((day): day is string => typeof day === "string")
      : [];
    return { days, count: 0 };
  } catch {
    return { days: [], count: 0 };
  }
}

export function readStreak(today: string): StreakRecord {
  try {
    const stored = parseStreakRecord(localStorage.getItem(STREAK_KEY));
    return { days: stored.days, count: streakCount(stored.days, today) };
  } catch {
    return { days: [], count: 0 };
  }
}

export function writeStreak(record: StreakRecord): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ days: record.days }));
  } catch {
    /* private mode */
  }
}
