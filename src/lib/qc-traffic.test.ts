import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectClientQc,
  hasQcParam,
  isCountingDeployment,
  isQcRequest,
  isQcUserAgent,
  QC_STORAGE_KEY,
  shouldCountRequest,
} from "./qc-traffic.ts";
import { isBotUserAgent } from "./visitor-count.ts";

const HEADLESS =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36";
// The emulated iPhone our QC harness ran (Playwright device descriptor on WebKit 26).
const QC_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const REAL_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const REAL_IOS15 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
const REAL_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function headers(map: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

function memStore() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("isQcUserAgent", () => {
  it("flags HeadlessChrome, Playwright and the emulated QC iPhone", () => {
    assert.equal(isQcUserAgent(HEADLESS), true);
    assert.equal(isQcUserAgent("Mozilla/5.0 Playwright/1.63"), true);
    assert.equal(isQcUserAgent(QC_IPHONE), true);
  });
  it("leaves real browsers alone (including real iOS 15 Safari)", () => {
    for (const ua of [REAL_IPHONE, REAL_IOS15, REAL_CHROME, "", null, undefined]) {
      assert.equal(isQcUserAgent(ua), false, String(ua));
    }
  });
});

describe("bot filter includes the QC markers", () => {
  it("treats QC browsers as bots", () => {
    assert.equal(isBotUserAgent(HEADLESS), true);
    assert.equal(isBotUserAgent(QC_IPHONE), true);
    assert.equal(isBotUserAgent("Mozilla/5.0 Playwright/1.63"), true);
  });
  it("still counts real browsers", () => {
    assert.equal(isBotUserAgent(REAL_IPHONE), false);
    assert.equal(isBotUserAgent(REAL_IOS15), false);
    assert.equal(isBotUserAgent(REAL_CHROME), false);
  });
});

describe("hasQcParam", () => {
  it("reads qc=1 from absolute / relative URLs and query strings", () => {
    assert.equal(hasQcParam("https://atmanmusic.app/?qc=1"), true);
    assert.equal(hasQcParam("/?tablet=x&qc=1"), true);
    assert.equal(hasQcParam("?qc=1"), true);
    assert.equal(hasQcParam("https://atmanmusic.app/?qc=0"), false);
    assert.equal(hasQcParam("https://atmanmusic.app/"), false);
    assert.equal(hasQcParam(null), false);
  });
});

describe("isQcRequest / shouldCountRequest", () => {
  const fnUrl = "https://atmanmusic.app/_serverFn/abc";
  it("recognises the x-qc-test header", () => {
    assert.equal(isQcRequest({ url: fnUrl, headers: headers({ "user-agent": REAL_CHROME, "x-qc-test": "1" }) }), true);
    assert.equal(isQcRequest({ url: fnUrl, headers: headers({ "user-agent": REAL_CHROME, "x-qc-test": "0" }) }), false);
  });
  it("recognises ?qc=1 on the request or the referring page", () => {
    assert.equal(isQcRequest({ url: `${fnUrl}?qc=1`, headers: headers({ "user-agent": REAL_CHROME }) }), true);
    assert.equal(
      isQcRequest({ url: fnUrl, headers: headers({ "user-agent": REAL_CHROME, referer: "https://atmanmusic.app/?qc=1" }) }),
      true,
    );
  });
  it("recognises QC user agents", () => {
    assert.equal(isQcRequest({ url: fnUrl, headers: headers({ "user-agent": QC_IPHONE }) }), true);
    assert.equal(isQcRequest({ url: fnUrl, headers: headers({ "user-agent": HEADLESS }) }), true);
  });
  it("only the production deployment counts, and never QC traffic", () => {
    const real = { url: fnUrl, headers: headers({ "user-agent": REAL_IPHONE, referer: "https://atmanmusic.app/" }) };
    assert.equal(shouldCountRequest(real, "production"), true);
    assert.equal(shouldCountRequest(real, "preview"), false);
    assert.equal(shouldCountRequest(real, "development"), false);
    assert.equal(shouldCountRequest(real, undefined), false);
    assert.equal(shouldCountRequest({ url: fnUrl, headers: headers({ "user-agent": QC_IPHONE }) }, "production"), false);
    assert.equal(
      shouldCountRequest({ url: fnUrl, headers: headers({ "user-agent": REAL_IPHONE, referer: "https://atmanmusic.app/?qc=1" }) }, "production"),
      false,
    );
    assert.equal(isCountingDeployment("production"), true);
  });
});

describe("detectClientQc", () => {
  it("?qc=1 turns QC on and persists it to every store", () => {
    const s = memStore();
    const l = memStore();
    assert.equal(detectClientQc({ search: "?qc=1", userAgent: REAL_IPHONE, stores: [s, l] }), true);
    assert.equal(s.m.get(QC_STORAGE_KEY), "1");
    assert.equal(l.m.get(QC_STORAGE_KEY), "1");
    // Later navigation without the flag stays in QC mode.
    assert.equal(detectClientQc({ search: "", userAgent: REAL_IPHONE, stores: [s, l] }), true);
  });
  it("?qc=0 clears the flag", () => {
    const s = memStore();
    s.setItem(QC_STORAGE_KEY, "1");
    assert.equal(detectClientQc({ search: "?qc=0", userAgent: REAL_IPHONE, stores: [s] }), false);
    assert.equal(s.m.has(QC_STORAGE_KEY), false);
  });
  it("QC user agents and webdriver are QC without any flag", () => {
    assert.equal(detectClientQc({ search: "", userAgent: QC_IPHONE, stores: [] }), true);
    assert.equal(detectClientQc({ search: "", userAgent: HEADLESS }), true);
    assert.equal(detectClientQc({ search: "", userAgent: REAL_CHROME, webdriver: true }), true);
  });
  it("real visitors are not QC, and blocked storage never throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    assert.equal(detectClientQc({ search: "?tablet=x", userAgent: REAL_IPHONE, stores: [broken] }), false);
    assert.equal(detectClientQc({ search: "?qc=1", userAgent: REAL_IPHONE, stores: [broken] }), true);
  });
});
