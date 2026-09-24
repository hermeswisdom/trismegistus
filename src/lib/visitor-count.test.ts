import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  badgeText,
  COUNT_WINDOW_HOURS,
  isBotUserAgent,
  isOnline,
  isValidVisitorId,
  newVisitorId,
  onlineLabel,
  parseCounts,
  PRUNE_AFTER_HOURS,
  readOrCreateVisitorId,
  shouldCountVisit,
  shouldPrune,
  totalLabel,
  VISITOR_ID_KEY,
} from "./visitor-count.ts";

const HOUR = 3600 * 1000;

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("badge copy", () => {
  it("reads like the spec with thousands separators", () => {
    assert.equal(badgeText({ online: 3, total: 1204 }), "3 listening now · 1,204 visitors");
  });
  it("handles the singular visitor", () => {
    assert.equal(totalLabel(1), "1 visitor");
    assert.equal(totalLabel(0), "0 visitors");
    assert.equal(totalLabel(2), "2 visitors");
    assert.equal(badgeText({ online: 1, total: 1 }), "1 listening now · 1 visitor");
  });
  it("formats large live counts", () => {
    assert.equal(onlineLabel(12345), "12,345 listening now");
  });
});

describe("parseCounts", () => {
  it("accepts numbers and numeric strings", () => {
    assert.deepEqual(parseCounts({ online: 2, total: "40" }), { online: 2, total: 40 });
  });
  it("never shows a total below the live count", () => {
    assert.deepEqual(parseCounts({ online: 5, total: 3 }), { online: 5, total: 5 });
  });
  it("returns null (badge hides) for missing or bad data", () => {
    assert.equal(parseCounts(null), null);
    assert.equal(parseCounts(undefined), null);
    assert.equal(parseCounts({ online: 1, total: null }), null);
    assert.equal(parseCounts({ online: -1, total: 3 }), null);
    assert.equal(parseCounts({ online: "x", total: 3 }), null);
  });
});

describe("counting windows", () => {
  it("counts a never-seen browser", () => {
    assert.equal(shouldCountVisit(null, 1_000), true);
  });
  it("counts a browser once per 24h", () => {
    const t0 = 10 * HOUR;
    assert.equal(shouldCountVisit(t0, t0 + 1 * HOUR), false);
    assert.equal(shouldCountVisit(t0, t0 + 23.9 * HOUR), false);
    assert.equal(shouldCountVisit(t0, t0 + COUNT_WINDOW_HOURS * HOUR), true);
  });
  it("treats heartbeats within ~2 minutes as online", () => {
    assert.equal(isOnline(0, 119_000), true);
    assert.equal(isOnline(0, 120_000), true);
    assert.equal(isOnline(0, 121_000), false);
  });
  it("keeps presence rows past the count window before pruning", () => {
    assert.ok(PRUNE_AFTER_HOURS > COUNT_WINDOW_HOURS);
  });
  it("prunes on a small fraction of heartbeats", () => {
    assert.equal(shouldPrune(0), true);
    assert.equal(shouldPrune(0.5), false);
    assert.equal(shouldPrune(0.999), false);
  });
});

describe("bots", () => {
  it("skips obvious crawlers and tooling", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "facebookexternalhit/1.1",
      "Twitterbot/1.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36",
      "curl/8.4.0",
      "python-requests/2.31",
      "",
      null,
    ]) {
      assert.equal(isBotUserAgent(ua), true, String(ua));
    }
  });
  it("lets real browsers through", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:129.0) Gecko/20100101 Firefox/129.0",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36",
    ]) {
      assert.equal(isBotUserAgent(ua), false, ua);
    }
  });
});

describe("anonymous id", () => {
  it("mints random, valid, distinct ids", () => {
    const a = newVisitorId();
    const b = newVisitorId();
    assert.ok(isValidVisitorId(a));
    assert.notEqual(a, b);
  });
  it("rejects anything that is not a random token", () => {
    assert.equal(isValidVisitorId("me@example.com"), false);
    assert.equal(isValidVisitorId("short"), false);
    assert.equal(isValidVisitorId("x".repeat(20)), false);
    assert.equal(isValidVisitorId("a".repeat(65)), false);
    assert.equal(isValidVisitorId(42), false);
  });
  it("persists one id in storage and reuses it", () => {
    const store = memoryStore();
    const first = readOrCreateVisitorId(store);
    assert.equal(store.data.get(VISITOR_ID_KEY), first);
    assert.equal(readOrCreateVisitorId(store), first);
  });
  it("replaces a tampered stored value", () => {
    const store = memoryStore({ [VISITOR_ID_KEY]: "not an id!" });
    const id = readOrCreateVisitorId(store);
    assert.ok(isValidVisitorId(id));
    assert.equal(store.data.get(VISITOR_ID_KEY), id);
  });
  it("still works when storage throws or is missing", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    assert.ok(isValidVisitorId(readOrCreateVisitorId(broken)));
    assert.ok(isValidVisitorId(readOrCreateVisitorId(null)));
  });
});
