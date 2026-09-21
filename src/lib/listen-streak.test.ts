import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  markListenDay,
  parseStreakRecord,
  shouldCreditListen,
  streakCount,
} from "./listen-streak.ts";

describe("addCalendarDays", () => {
  it("crosses month and year boundaries", () => {
    assert.equal(addCalendarDays("2026-09-30", 1), "2026-10-01");
    assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addCalendarDays("2026-10-01", -1), "2026-09-30");
  });
});

describe("streakCount", () => {
  it("counts consecutive days ending today", () => {
    assert.equal(
      streakCount(["2026-09-19", "2026-09-20", "2026-09-21"], "2026-09-21"),
      3,
    );
  });

  it("keeps yesterday's streak until today is marked", () => {
    assert.equal(streakCount(["2026-09-20", "2026-09-21"], "2026-09-22"), 2);
  });

  it("breaks after a missed day", () => {
    assert.equal(streakCount(["2026-09-18", "2026-09-21"], "2026-09-21"), 1);
    assert.equal(streakCount(["2026-09-18"], "2026-09-21"), 0);
  });
});

describe("markListenDay", () => {
  it("is idempotent for the same day and grows a streak", () => {
    const first = markListenDay(["2026-09-20"], "2026-09-21");
    const again = markListenDay(first.days, "2026-09-21");
    assert.equal(first.count, 2);
    assert.deepEqual(again.days, first.days);
    assert.equal(again.count, 2);
  });
});

describe("shouldCreditListen", () => {
  it("credits only today's tablet after thirty seconds", () => {
    assert.equal(
      shouldCreditListen({
        trackId: "fragile-god",
        dailyId: "fragile-god",
        elapsed: 29.9,
      }),
      false,
    );
    assert.equal(
      shouldCreditListen({
        trackId: "fragile-god",
        dailyId: "fragile-god",
        elapsed: 30,
      }),
      true,
    );
    assert.equal(
      shouldCreditListen({
        trackId: "the-sleepers-waking",
        dailyId: "fragile-god",
        elapsed: 90,
      }),
      false,
    );
  });
});

describe("parseStreakRecord", () => {
  it("reads a stored day list and ignores junk", () => {
    assert.deepEqual(parseStreakRecord(null).days, []);
    assert.deepEqual(
      parseStreakRecord(JSON.stringify({ days: ["2026-09-21", 3, "x"] })).days,
      ["2026-09-21", "x"],
    );
    assert.deepEqual(parseStreakRecord("not-json").days, []);
  });
});
