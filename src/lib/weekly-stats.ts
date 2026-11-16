import { createHash, timingSafeEqual } from "node:crypto";
import { LONDON_TZ, londonDateKey } from "./daily-tablet.ts";
import { addCalendarDays } from "./listen-streak.ts";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";

/**
 * Test traffic never lands in `listen_marks`: `recordPlay` only inserts when
 * `shouldCountRequest` is true (PR #29 — production, not QC). This module only
 * SELECTs those rows; do not invent a second QC filter here.
 */

export const STATS_TZ = LONDON_TZ;
export const QUERY_TIMEOUT_MS = 18_000;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export class QueryTimeoutError extends Error {
  constructor(message = "query timeout") {
    super(message);
    this.name = "QueryTimeoutError";
  }
}

export type DateKey = string;

export type StatsWindow = {
  range: { from: DateKey; to: DateKey; tz: typeof STATS_TZ };
  previous: { from: DateKey; to: DateKey };
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
};

export type WeeklyStatsJson = {
  range: { from: DateKey; to: DateKey; tz: string };
  previous: { from: DateKey; to: DateKey };
  totals: {
    current: { listens: number; distinctTracks: number };
    previous: { listens: number; distinctTracks: number };
  };
  topTracks: { slug: string; title: string; count: number }[];
};

export type StatsQuery = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

/** Inclusive civil [from, to] in Europe/London, as timestamptz bounds. */
export const WEEKLY_STATS_SQL = `
select
  (select count(*)::int from listen_marks
    where created_at >= $1::timestamptz and created_at < $2::timestamptz) as "currentListens",
  (select count(distinct track_id)::int from listen_marks
    where created_at >= $1::timestamptz and created_at < $2::timestamptz) as "currentDistinct",
  (select count(*)::int from listen_marks
    where created_at >= $3::timestamptz and created_at < $4::timestamptz) as "previousListens",
  (select count(distinct track_id)::int from listen_marks
    where created_at >= $3::timestamptz and created_at < $4::timestamptz) as "previousDistinct",
  coalesce((
    select json_agg(json_build_object('trackId', g.track_id, 'count', g.count)
                    order by g.count desc, g.track_id asc)
    from (
      select track_id, count(*)::int as count
      from listen_marks
      where created_at >= $1::timestamptz and created_at < $2::timestamptz
      group by track_id
      order by count desc, track_id asc
      limit 10
    ) g
  ), '[]'::json) as "topTracks"
`;

export function parseDateKey(value: string | null | undefined): DateKey | null {
  const raw = value?.trim() ?? "";
  const match = DATE_KEY.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return raw;
}

function civilDaysInclusive(from: DateKey, to: DateKey): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/** UTC instant of `YYYY-MM-DD` 00:00 in Europe/London (DST-safe). */
export function londonMidnightUtc(dateKey: DateKey): Date {
  if (!parseDateKey(dateKey)) throw new Error("invalid date");
  const utcGuess = new Date(`${dateKey}T00:00:00.000Z`);
  const offsetMs = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: STATS_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(
      pick("year"),
      pick("month") - 1,
      pick("day"),
      pick("hour"),
      pick("minute"),
      pick("second"),
    );
    return asUtc - instant.getTime();
  };
  const once = new Date(utcGuess.getTime() - offsetMs(utcGuess));
  return new Date(utcGuess.getTime() - offsetMs(once));
}

function londonMondayOffset(dateKey: DateKey): number {
  const parsed = parseDateKey(dateKey);
  if (!parsed) throw new Error("invalid date");
  const jsDay = new Date(`${parsed}T12:00:00Z`).getUTCDay();
  return (jsDay + 6) % 7;
}

/** Most recently completed Mon–Sun civil week in Europe/London. */
export function completedLondonWeek(at: Date = new Date()): { from: DateKey; to: DateKey } {
  const today = londonDateKey(at);
  const daysSinceMonday = londonMondayOffset(today);
  const thisMonday = addCalendarDays(today, -daysSinceMonday);
  return {
    from: addCalendarDays(thisMonday, -7),
    to: addCalendarDays(thisMonday, -1),
  };
}

export function sameLengthPrevious(from: DateKey, to: DateKey): { from: DateKey; to: DateKey } {
  const length = civilDaysInclusive(from, to);
  return {
    from: addCalendarDays(from, -length),
    to: addCalendarDays(from, -1),
  };
}

export function boundsForInclusiveRange(from: DateKey, to: DateKey): { start: Date; end: Date } {
  return {
    start: londonMidnightUtc(from),
    end: londonMidnightUtc(addCalendarDays(to, 1)),
  };
}

export function resolveStatsWindow(
  params: { from?: string | null; to?: string | null },
  at: Date = new Date(),
): { ok: true; window: StatsWindow } | { ok: false; error: string } {
  const fromRaw = params.from;
  const toRaw = params.to;
  const fromPresent = fromRaw != null && String(fromRaw).trim() !== "";
  const toPresent = toRaw != null && String(toRaw).trim() !== "";
  if (fromPresent !== toPresent) {
    return { ok: false, error: "from and to must both be set" };
  }

  let from: DateKey;
  let to: DateKey;
  if (!fromPresent) {
    const week = completedLondonWeek(at);
    from = week.from;
    to = week.to;
  } else {
    const parsedFrom = parseDateKey(fromRaw);
    const parsedTo = parseDateKey(toRaw);
    if (!parsedFrom || !parsedTo) {
      return { ok: false, error: "from and to must be YYYY-MM-DD" };
    }
    if (parsedFrom > parsedTo) {
      return { ok: false, error: "from must be on or before to" };
    }
    from = parsedFrom;
    to = parsedTo;
  }

  const previous = sameLengthPrevious(from, to);
  const current = boundsForInclusiveRange(from, to);
  const prev = boundsForInclusiveRange(previous.from, previous.to);
  return {
    ok: true,
    window: {
      range: { from, to, tz: STATS_TZ },
      previous,
      currentStart: current.start,
      currentEnd: current.end,
      previousStart: prev.start,
      previousEnd: prev.end,
    },
  };
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function readBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer[ \t]+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token || null;
}

/** Constant-time compare of the Bearer credential to STATS_TOKEN. Never log either. */
export function authorizeStatsToken(
  header: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  const secret = expected?.trim();
  if (!secret) return false;
  const got = readBearerToken(header);
  if (!got) return false;
  return timingSafeEqual(sha256(got), sha256(secret));
}

export function isRetryableDbError(err: unknown): boolean {
  if (err instanceof QueryTimeoutError) return true;
  if (!err || typeof err !== "object") return false;
  const code = "code" in err && typeof err.code === "string" ? err.code : "";
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EPIPE" ||
    code === "EAI_AGAIN" ||
    code === "ECONNABORTED" ||
    code === "57P01" ||
    code === "57P02" ||
    code === "57P03" ||
    code === "08000" ||
    code === "08001" ||
    code === "08003" ||
    code === "08004" ||
    code === "08006"
  ) {
    return true;
  }
  const message = "message" in err && typeof err.message === "string" ? err.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection terminated") ||
    message.includes("connection refused") ||
    message.includes("connection reset") ||
    message.includes("cannot connect") ||
    message.includes("server closed the connection") ||
    message.includes("remaining connection slots") ||
    message.includes("too many connections") ||
    message.includes("the database system is starting up") ||
    message.includes("the database system is shutting down") ||
    message.includes("failed to connect") ||
    message.includes("connection error")
  );
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new QueryTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function queryWithRetry<T>(
  run: () => Promise<T>,
  timeoutMs: number = QUERY_TIMEOUT_MS,
): Promise<T> {
  try {
    return await withTimeout(run(), timeoutMs);
  } catch (err) {
    if (!isRetryableDbError(err)) throw err;
    return await withTimeout(run(), timeoutMs);
  }
}

type TopRow = { trackId: string; count: number };

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseTopTracks(raw: unknown): TopRow[] {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(value)) return [];
  const rows: TopRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const trackId =
      "trackId" in item && typeof item.trackId === "string"
        ? item.trackId
        : "track_id" in item && typeof item.track_id === "string"
          ? item.track_id
          : "";
    if (!trackId) continue;
    rows.push({ trackId, count: asNumber("count" in item ? item.count : 0) });
  }
  return rows;
}

function catalogueEntry(trackId: string): { slug: string; title: string } {
  const track = SOUNDCLOUD_TRACKS.find((row) => row.id === trackId || row.slug === trackId);
  if (track) return { slug: track.slug, title: track.title };
  return { slug: trackId, title: trackId };
}

function jsonHeaders(): HeadersInit {
  return { "Cache-Control": "no-store", "Content-Type": "application/json" };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders() });
}

export async function loadWeeklyStats(
  query: StatsQuery,
  window: StatsWindow,
  timeoutMs: number = QUERY_TIMEOUT_MS,
): Promise<WeeklyStatsJson> {
  const rows = await queryWithRetry(
    () =>
      query(WEEKLY_STATS_SQL, [
        window.currentStart.toISOString(),
        window.currentEnd.toISOString(),
        window.previousStart.toISOString(),
        window.previousEnd.toISOString(),
      ]),
    timeoutMs,
  );
  const row = rows[0] ?? {};
  const topTracks = parseTopTracks(row.topTracks).map((item) => ({
    ...catalogueEntry(item.trackId),
    count: item.count,
  }));
  return {
    range: window.range,
    previous: window.previous,
    totals: {
      current: {
        listens: asNumber(row.currentListens),
        distinctTracks: asNumber(row.currentDistinct),
      },
      previous: {
        listens: asNumber(row.previousListens),
        distinctTracks: asNumber(row.previousDistinct),
      },
    },
    topTracks,
  };
}

export type WeeklyStatsDeps = {
  token?: string | null;
  query?: StatsQuery;
  now?: Date;
  timeoutMs?: number;
};

async function defaultQuery(text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const { getSql } = await import("./db.ts");
  const sql = await getSql();
  return sql.query(text, params);
}

export async function handleWeeklyStatsRequest(
  request: Request,
  deps: WeeklyStatsDeps = {},
): Promise<Response> {
  const token = deps.token === undefined ? process.env.STATS_TOKEN : deps.token;
  if (!authorizeStatsToken(request.headers.get("authorization"), token)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const resolved = resolveStatsWindow(
    { from: url.searchParams.get("from"), to: url.searchParams.get("to") },
    deps.now ?? new Date(),
  );
  if (!resolved.ok) {
    return jsonResponse({ error: resolved.error }, 400);
  }

  try {
    const body = await loadWeeklyStats(
      deps.query ?? defaultQuery,
      resolved.window,
      deps.timeoutMs ?? QUERY_TIMEOUT_MS,
    );
    return jsonResponse(body, 200);
  } catch (err) {
    if (isRetryableDbError(err)) {
      return jsonResponse({ error: "database unavailable" }, 503);
    }
    return jsonResponse({ error: "stats query failed" }, 500);
  }
}
