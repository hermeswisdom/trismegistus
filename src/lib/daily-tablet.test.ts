import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fnv1a,
  londonDateKey,
  pickDailyTablet,
  resolveFocusedTablet,
} from "./daily-tablet.ts";

const CATALOG = [
  "the-sleepers-waking",
  "fragile-god",
  "wait-for-a-love-that-stays",
  "now-i-see-you-blossom",
  "the-endless-mirror",
];

describe("londonDateKey", () => {
  it("uses the Europe/London civil day, not UTC", () => {
    // 21 Sep 2026 23:30 UTC is 22 Sep 00:30 in London (BST, UTC+1).
    assert.equal(
      londonDateKey(new Date("2026-09-21T23:30:00.000Z")),
      "2026-09-22",
    );
    assert.equal(
      londonDateKey(new Date("2026-09-21T22:30:00.000Z")),
      "2026-09-21",
    );
  });

  it("stays on the UTC date while London is on GMT", () => {
    assert.equal(
      londonDateKey(new Date("2026-12-21T23:30:00.000Z")),
      "2026-12-21",
    );
    assert.equal(
      londonDateKey(new Date("2026-12-22T00:30:00.000Z")),
      "2026-12-22",
    );
  });
});

describe("pickDailyTablet", () => {
  it("is stable for the same London date and catalog", () => {
    const a = pickDailyTablet(CATALOG, "2026-09-21");
    const b = pickDailyTablet(CATALOG, "2026-09-21");
    assert.equal(a, b);
    assert.equal(CATALOG.includes(a), true);
  });

  it("can land on a different tablet when the date changes", () => {
    const first = pickDailyTablet(CATALOG, "2026-09-21");
    const days = Array.from({ length: 40 }, (_, i) =>
      pickDailyTablet(CATALOG, `2026-10-${String(i + 1).padStart(2, "0")}`),
    );
    assert.equal(
      days.some((id) => id !== first),
      true,
      "a month of days should not all pick the same tablet",
    );
  });

  it("rejects an empty catalog", () => {
    assert.throws(() => pickDailyTablet([], "2026-09-21"), /catalog/);
  });
});

describe("fnv1a", () => {
  it("returns a stable unsigned 32-bit value", () => {
    assert.equal(fnv1a("atman-daily:2026-09-21"), fnv1a("atman-daily:2026-09-21"));
    assert.notEqual(fnv1a("atman-daily:2026-09-21"), fnv1a("atman-daily:2026-09-22"));
    assert.equal(fnv1a("x") >= 0, true);
  });
});

describe("resolveFocusedTablet", () => {
  it("prefers a known tablet slug over the daily pick", () => {
    const focus = resolveFocusedTablet({
      daily: true,
      tablet: "fragile-god",
      ids: CATALOG,
      dateKey: "2026-09-21",
    });
    assert.deepEqual(focus, { trackId: "fragile-god", source: "tablet" });
  });

  it("uses the daily seed when asked, and none when not", () => {
    const daily = resolveFocusedTablet({
      daily: true,
      ids: CATALOG,
      dateKey: "2026-09-21",
    });
    const none = resolveFocusedTablet({
      ids: CATALOG,
      dateKey: "2026-09-21",
    });
    assert.equal(daily.source, "daily");
    assert.equal(none.source, "none");
    assert.equal(daily.trackId, none.trackId);
    assert.equal(daily.trackId, pickDailyTablet(CATALOG, "2026-09-21"));
  });

  it("resolves aliases through resolveId", () => {
    const focus = resolveFocusedTablet({
      tablet: "Fragile God",
      ids: CATALOG,
      dateKey: "2026-09-21",
      resolveId: (value) => (value === "Fragile God" ? "fragile-god" : undefined),
    });
    assert.deepEqual(focus, { trackId: "fragile-god", source: "tablet" });
  });
});
