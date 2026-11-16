import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  QUERY_TIMEOUT_MS,
  WEEKLY_STATS_SQL,
  authorizeStatsToken,
  boundsForInclusiveRange,
  completedLondonWeek,
  handleWeeklyStatsRequest,
  isRetryableDbError,
  londonMidnightUtc,
  parseDateKey,
  QueryTimeoutError,
  resolveStatsWindow,
  sameLengthPrevious,
} from "./weekly-stats.ts";

const TOKEN = "stats-test-token";
const SRC = readFileSync(new URL("./weekly-stats.ts", import.meta.url), "utf8");
const PLAYS = readFileSync(new URL("./plays.ts", import.meta.url), "utf8");
const ROUTE = readFileSync(new URL("../routes/api/stats/weekly.ts", import.meta.url), "utf8");

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}

function req(path = "/api/stats/weekly", headers: Record<string, string> = {}) {
  return new Request(`https://atmanmusic.app${path}`, { headers });
}

function authed(path = "/api/stats/weekly") {
  return req(path, { authorization: `Bearer ${TOKEN}` });
}

describe("parseDateKey", () => {
  it("accepts real YYYY-MM-DD dates and rejects the rest", () => {
    assert.equal(parseDateKey("2026-11-09"), "2026-11-09");
    assert.equal(parseDateKey(" 2026-11-09 "), "2026-11-09");
    assert.equal(parseDateKey("2026-02-29"), null);
    assert.equal(parseDateKey("2026-13-01"), null);
    assert.equal(parseDateKey("2026-11-9"), null);
    assert.equal(parseDateKey("11-09-2026"), null);
    assert.equal(parseDateKey(""), null);
    assert.equal(parseDateKey(null), null);
  });
});

describe("Europe/London week boundaries", () => {
  it("defaults to the most recent completed Mon–Sun week", () => {
    // Monday 16 Nov 2026 09:39 London (GMT) → 9–15 Nov.
    assert.deepEqual(
      completedLondonWeek(new Date("2026-11-16T09:39:00.000Z")),
      { from: "2026-11-09", to: "2026-11-15" },
    );
    // Sunday evening: current week is not complete yet.
    assert.deepEqual(
      completedLondonWeek(new Date("2026-11-15T21:00:00.000Z")),
      { from: "2026-11-02", to: "2026-11-08" },
    );
    // Wednesday still reports last completed week.
    assert.deepEqual(
      completedLondonWeek(new Date("2026-11-18T12:00:00.000Z")),
      { from: "2026-11-09", to: "2026-11-15" },
    );
  });

  it("uses London's weekday, not UTC, around a BST midnight", () => {
    // Sun 29 Mar 2026 23:30 UTC = Mon 30 Mar 00:30 BST.
    assert.deepEqual(
      completedLondonWeek(new Date("2026-03-29T23:30:00.000Z")),
      { from: "2026-03-23", to: "2026-03-29" },
    );
    // Still Sunday in London an hour earlier.
    assert.deepEqual(
      completedLondonWeek(new Date("2026-03-29T22:30:00.000Z")),
      { from: "2026-03-16", to: "2026-03-22" },
    );
  });

  it("keeps GMT and BST midnights DST-safe", () => {
    assert.equal(londonMidnightUtc("2026-01-05").toISOString(), "2026-01-05T00:00:00.000Z");
    assert.equal(londonMidnightUtc("2026-07-06").toISOString(), "2026-07-05T23:00:00.000Z");
    // Spring-forward Sunday: midnight is still GMT; the next Monday is BST.
    assert.equal(londonMidnightUtc("2026-03-29").toISOString(), "2026-03-29T00:00:00.000Z");
    assert.equal(londonMidnightUtc("2026-03-30").toISOString(), "2026-03-29T23:00:00.000Z");
    // Fall-back Sunday: midnight is still BST; the next Monday is GMT.
    assert.equal(londonMidnightUtc("2026-10-25").toISOString(), "2026-10-24T23:00:00.000Z");
    assert.equal(londonMidnightUtc("2026-10-26").toISOString(), "2026-10-26T00:00:00.000Z");
  });

  it("the spring-forward week is 167 hours; the fall-back week is 169", () => {
    const spring = boundsForInclusiveRange("2026-03-23", "2026-03-29");
    const autumn = boundsForInclusiveRange("2026-10-19", "2026-10-25");
    const winter = boundsForInclusiveRange("2026-01-05", "2026-01-11");
    const summer = boundsForInclusiveRange("2026-07-06", "2026-07-12");
    assert.equal(hoursBetween(spring.start, spring.end), 167);
    assert.equal(hoursBetween(autumn.start, autumn.end), 169);
    assert.equal(hoursBetween(winter.start, winter.end), 168);
    assert.equal(hoursBetween(summer.start, summer.end), 168);
  });

  it("previous range is the same number of civil days, immediately before", () => {
    assert.deepEqual(sameLengthPrevious("2026-11-09", "2026-11-15"), {
      from: "2026-11-02",
      to: "2026-11-08",
    });
    const spring = resolveStatsWindow({ from: "2026-03-23", to: "2026-03-29" });
    assert.equal(spring.ok, true);
    if (!spring.ok) return;
    assert.deepEqual(spring.window.previous, { from: "2026-03-16", to: "2026-03-22" });
    assert.equal(spring.window.previousEnd.toISOString(), spring.window.currentStart.toISOString());
    const autumn = resolveStatsWindow({ from: "2026-10-19", to: "2026-10-25" });
    assert.equal(autumn.ok, true);
    if (!autumn.ok) return;
    assert.deepEqual(autumn.window.previous, { from: "2026-10-12", to: "2026-10-18" });
    assert.equal(autumn.window.previousEnd.toISOString(), autumn.window.currentStart.toISOString());
  });

  it("rejects half-specified or impossible query ranges", () => {
    assert.equal(resolveStatsWindow({ from: "2026-11-09" }).ok, false);
    assert.equal(resolveStatsWindow({ to: "2026-11-15" }).ok, false);
    assert.equal(resolveStatsWindow({ from: "2026-11-16", to: "2026-11-09" }).ok, false);
    assert.equal(resolveStatsWindow({ from: "nope", to: "2026-11-15" }).ok, false);
  });
});

describe("auth", () => {
  it("rejects missing, wrong, or unset STATS_TOKEN in constant time", () => {
    assert.equal(authorizeStatsToken("Bearer secret", "secret"), true);
    assert.equal(authorizeStatsToken("bearer secret", "secret"), true);
    assert.equal(authorizeStatsToken("Bearer nope", "secret"), false);
    assert.equal(authorizeStatsToken("Bearer secret", "secrets"), false);
    assert.equal(authorizeStatsToken(null, "secret"), false);
    assert.equal(authorizeStatsToken("Bearer secret", undefined), false);
    assert.equal(authorizeStatsToken("Bearer secret", ""), false);
    assert.equal(authorizeStatsToken("Basic secret", "secret"), false);
  });

  it("returns 401 before touching the database", async () => {
    let queried = false;
    const query = async () => {
      queried = true;
      return [];
    };
    const missing = await handleWeeklyStatsRequest(req(), { token: TOKEN, query });
    const wrong = await handleWeeklyStatsRequest(req("/api/stats/weekly", { authorization: "Bearer nope" }), {
      token: TOKEN,
      query,
    });
    const unset = await handleWeeklyStatsRequest(authed(), { token: "", query });
    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(unset.status, 401);
    assert.equal(queried, false);
    assert.equal(missing.headers.get("cache-control"), "no-store");
  });

  it("never logs the token", () => {
    assert.doesNotMatch(SRC, /console\.(log|info|debug|warn|error)/);
  });
});

describe("weekly stats response", () => {
  it("is a SELECT-only listen_marks query that reuses the PR #29 write filter", () => {
    assert.match(WEEKLY_STATS_SQL.trim(), /^select\b/i);
    assert.match(WEEKLY_STATS_SQL, /listen_marks/);
    assert.doesNotMatch(
      WEEKLY_STATS_SQL,
      /\b(insert|update|delete|alter|drop|create|truncate|grant|copy|refresh)\b/i,
    );
    assert.doesNotMatch(WEEKLY_STATS_SQL, /qc|user.agent|headless|playwright/i);
    assert.match(PLAYS, /shouldCountRequest/);
    assert.match(PLAYS, /insert into listen_marks/);
    assert.match(SRC, /shouldCountRequest/);
    assert.match(SRC, /PR #29/);
    assert.equal(QUERY_TIMEOUT_MS >= 15_000 && QUERY_TIMEOUT_MS <= 20_000, true);
  });

  it("returns the documented JSON shape with catalogue titles", async () => {
    const query = async (_text: string, params?: unknown[]) => {
      assert.equal(params?.length, 4);
      return [
        {
          currentListens: 12,
          currentDistinct: 2,
          previousListens: 5,
          previousDistinct: 1,
          topTracks: [
            { trackId: "nobody-cares", count: 8 },
            { trackId: "secret-teachings", count: 4 },
          ],
        },
      ];
    };
    const res = await handleWeeklyStatsRequest(
      authed("/api/stats/weekly?from=2026-11-09&to=2026-11-15"),
      { token: TOKEN, query },
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const body = await res.json();
    assert.deepEqual(body, {
      range: { from: "2026-11-09", to: "2026-11-15", tz: "Europe/London" },
      previous: { from: "2026-11-02", to: "2026-11-08" },
      totals: {
        current: { listens: 12, distinctTracks: 2 },
        previous: { listens: 5, distinctTracks: 1 },
      },
      topTracks: [
        { slug: "nobody-cares", title: "Nobody Cares", count: 8 },
        { slug: "secret-teachings", title: "Secret Teachings", count: 4 },
      ],
    });
  });

  it("returns 400 for a bad range and 503 after one retry on connection failure", async () => {
    const bad = await handleWeeklyStatsRequest(authed("/api/stats/weekly?from=2026-11-99&to=2026-11-15"), {
      token: TOKEN,
      query: async () => [],
    });
    assert.equal(bad.status, 400);

    let calls = 0;
    const down = await handleWeeklyStatsRequest(authed(), {
      token: TOKEN,
      now: new Date("2026-11-16T12:00:00.000Z"),
      query: async () => {
        calls += 1;
        const err = new Error("connection reset");
        (err as { code?: string }).code = "ECONNRESET";
        throw err;
      },
    });
    assert.equal(down.status, 503);
    assert.equal(calls, 2);

    let timeouts = 0;
    const slow = await handleWeeklyStatsRequest(authed(), {
      token: TOKEN,
      now: new Date("2026-11-16T12:00:00.000Z"),
      timeoutMs: 20,
      query: () => {
        timeouts += 1;
        return new Promise(() => {});
      },
    });
    assert.equal(slow.status, 503);
    assert.equal(timeouts, 2);
    assert.equal(isRetryableDbError(new QueryTimeoutError()), true);
  });

  it("is a GET server route at /api/stats/weekly", () => {
    assert.match(ROUTE, /createFileRoute\("\/api\/stats\/weekly"\)/);
    assert.match(ROUTE, /handleWeeklyStatsRequest/);
  });
});
