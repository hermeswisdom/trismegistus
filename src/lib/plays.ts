import { createServerFn } from "@tanstack/react-start";
import { evaluateMarkRate, type RateWindow } from "@/lib/mark-rate-limit";
import { TRACKS } from "@/lib/rooms";
import { chooseVisitorKey, extractClientIp } from "@/lib/visitor-key";

export type PlayRow = {
  trackId: string;
  plays: number;
};

export type RecentMark = {
  trackId: string;
  createdAt: string;
  mine?: boolean;
};

export type MarksBoard = {
  rows: PlayRow[];
  recent: RecentMark[];
};

const KNOWN = new Set(TRACKS.map((track) => track.id));
const VISITOR_COOKIE = "atman_mark_visitor";
const RECENT_LIMIT = 12;

const EMPTY_BOARD: MarksBoard = { rows: [], recent: [] };

async function readBoard(): Promise<MarksBoard> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let rows: PlayRow[] = [];
    let recent: RecentMark[] = [];
    try {
      rows = (
        await sql<PlayRow>`
          select track_id as "trackId", plays
          from track_plays
          order by plays desc, last_played_at desc
          limit 10
        `
      ).filter((row) => KNOWN.has(row.trackId));
    } catch {
      /* ranks stay empty if the plays table is missing */
    }
    try {
      recent = (
        await sql<RecentMark>`
          select
            track_id as "trackId",
            created_at::text as "createdAt"
          from listen_marks
          order by created_at desc
          limit ${RECENT_LIMIT}
        `
      ).filter((row) => KNOWN.has(row.trackId));
    } catch {
      /* pulse stays empty until 0005_listen_marks is applied */
    }
    return { rows, recent };
  } catch {
    return EMPTY_BOARD;
  }
}

function randomVisitorId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function visitorHash(): Promise<string> {
  const { createHash } = await import("node:crypto");
  const { getCookie, getRequest, setCookie } = await import(
    "@tanstack/react-start/server"
  );
  let cookieId = getCookie(VISITOR_COOKIE);
  const request = getRequest();
  if (!cookieId) {
    cookieId = randomVisitorId();
    const secure = request
      ? new URL(request.url).protocol === "https:"
      : true;
    try {
      setCookie(VISITOR_COOKIE, cookieId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        maxAge: 60 * 60 * 24 * 400,
      });
    } catch {
      /* no request context (build / tests) */
    }
  }
  const ip = request ? extractClientIp(request.headers) : null;
  return createHash("sha256")
    .update(chooseVisitorKey(cookieId, ip))
    .digest("hex")
    .slice(0, 40);
}

async function readRateWindow(hash: string): Promise<RateWindow | null> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      windowStart: number;
      markCount: number;
      lastMarkAt: number;
    }>`
      select
        (extract(epoch from window_start) * 1000)::bigint as "windowStart",
        mark_count as "markCount",
        (extract(epoch from last_mark_at) * 1000)::bigint as "lastMarkAt"
      from listen_mark_limits
      where visitor_hash = ${hash}
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function writeRateWindow(hash: string, next: RateWindow): Promise<void> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const windowStart = next.windowStart / 1000;
  const lastMarkAt = next.lastMarkAt / 1000;
  await sql`
    insert into listen_mark_limits (visitor_hash, window_start, mark_count, last_mark_at)
    values (
      ${hash},
      to_timestamp(${windowStart}),
      ${next.markCount},
      to_timestamp(${lastMarkAt})
    )
    on conflict (visitor_hash) do update
      set window_start = excluded.window_start,
          mark_count = excluded.mark_count,
          last_mark_at = excluded.last_mark_at
  `;
}

export const getMarksBoard = createServerFn({ method: "GET" }).handler(
  async () => readBoard(),
);

export const getPlayLeaderboard = createServerFn({ method: "GET" }).handler(
  async () => (await readBoard()).rows,
);

export const recordPlay = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<MarksBoard> => {
    if (!KNOWN.has(id)) return readBoard();
    try {
      const hash = await visitorHash();
      const now = Date.now();
      const decision = evaluateMarkRate(await readRateWindow(hash), now);
      if (!decision.allowed) return readBoard();

      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        insert into track_plays (track_id, plays, last_played_at)
        values (${id}, 1, now())
        on conflict (track_id) do update
          set plays = track_plays.plays + 1,
              last_played_at = now()
      `;
      try {
        await sql`
          insert into listen_marks (track_id)
          values (${id})
        `;
        await writeRateWindow(hash, decision.next);
      } catch {
        /* pulse / limits wait for 0005_listen_marks */
      }
    } catch {
      /* preview without a live DB still serves the page */
    }
    return readBoard();
  });
