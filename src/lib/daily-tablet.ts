export const LONDON_TZ = "Europe/London";

/** Civil date in Europe/London as `YYYY-MM-DD`. */
export function londonDateKey(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("could not read the London date");
  }
  return `${year}-${month}-${day}`;
}

/** 32-bit FNV-1a. Stable across runtimes. */
export function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic tablet for a London date against a catalog of ids. */
export function pickDailyTablet(ids: readonly string[], dateKey: string): string {
  if (ids.length === 0) {
    throw new Error("daily tablet needs a catalog");
  }
  return ids[fnv1a(`atman-daily:${dateKey}`) % ids.length]!;
}

export type FocusedTablet = {
  trackId: string;
  source: "daily" | "tablet" | "none";
};

export function resolveFocusedTablet(input: {
  daily?: boolean;
  tablet?: string;
  ids: readonly string[];
  dateKey: string;
  resolveId?: (value: string) => string | undefined;
}): FocusedTablet {
  const wanted = input.tablet?.trim();
  if (wanted) {
    const id =
      input.resolveId?.(wanted) ??
      (input.ids.includes(wanted) ? wanted : undefined);
    if (id) return { trackId: id, source: "tablet" };
  }
  const trackId = pickDailyTablet(input.ids, input.dateKey);
  if (input.daily) return { trackId, source: "daily" };
  return { trackId, source: "none" };
}
