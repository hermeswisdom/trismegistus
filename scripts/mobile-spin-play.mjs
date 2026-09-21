#!/usr/bin/env node
/**
 * Mobile spin + play QC. Mocks the SoundCloud widget so the rite can be
 * asserted without the live embed: Enter/Spin must change the selected
 * tablet, the disc must rotate, and a cover/dock gesture must call play.
 */
import { chromium, devices } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || process.env.MOBILE_SPIN_URL || "http://127.0.0.1:8080/");
const timeoutMs = Number(process.env.MOBILE_SPIN_TIMEOUT_MS || 45000);

const MOCK_SC = `
(() => {
  try { localStorage.removeItem("trismegistus-first-spin"); } catch {}
  window.__ATMAN_SPIN_MS = 700;
  const plays = [];
  const loads = [];
  const pauses = [];
  const listeners = {};
  const fire = (ev, payload) => {
    for (const fn of listeners[ev] || []) fn(payload);
  };
  const widget = {
    bind(ev, fn) {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
      if (ev === "ready") queueMicrotask(() => fn());
    },
    unbind(ev) { delete listeners[ev]; },
    play() { plays.push("play"); queueMicrotask(() => fire("play")); },
    pause() { pauses.push("pause"); queueMicrotask(() => fire("pause")); },
    toggle() {},
    load(url, opt) {
      loads.push({ url, auto: Boolean(opt && opt.auto_play) });
      queueMicrotask(() => fire("ready"));
      if (opt && opt.auto_play) queueMicrotask(() => fire("play"));
    },
    seekTo() {},
    getPosition(cb) { cb(0); },
    getDuration(cb) { cb(180000); },
    getVolume(cb) { cb(80); },
    setVolume() {},
    getCurrentSound(cb) { cb(null); },
  };
  const Widget = (el) => widget;
  Widget.Events = {
    READY: "ready",
    PLAY: "play",
    PAUSE: "pause",
    FINISH: "finish",
    PLAY_PROGRESS: "playProgress",
  };
  window.SC = { Widget };
  window.__scMock = { plays, loads, pauses, widget };
})();
`;

function fail(message, extra) {
  console.error(JSON.stringify({ ok: false, error: message, ...extra }, null, 2));
  process.exitCode = 1;
}

let browser = null;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const iphone = devices["iPhone 12 Pro"];
  const context = await browser.newContext({
    ...iphone,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(MOCK_SC);
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

  const enter = page.getByRole("button", { name: /^enter$/i });
  await enter.waitFor({ state: "visible" });
  await enter.tap();

  const disc = page.locator("[data-wheel-disc]");
  await disc.waitFor();
  await page.locator("[data-wheel-spinning='true']").waitFor({ timeout: 4000 });

  const rotated = await page.waitForFunction(() => {
    const el = document.querySelector("[data-wheel-disc]");
    if (!el) return false;
    const t = getComputedStyle(el).transform;
    return Boolean(t && t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)");
  }, null, { timeout: 4000 });
  if (!rotated) throw new Error("wheel did not rotate");

  await page.locator("[data-wheel-landed]").waitFor({ timeout: 8000 });
  await page.locator("[data-wheel-spinning='false']").waitFor({ timeout: 2000 });

  const landedId = await page.locator("[data-wheel-landed]").getAttribute("data-wheel-landed");
  const playerId = await page.locator("[data-player-current]").getAttribute("data-player-current");
  if (!landedId || landedId !== playerId) {
    throw new Error(`spin did not select the landed tablet (landed=${landedId} player=${playerId})`);
  }

  const afterSpin = await page.evaluate(() => ({
    plays: window.__scMock?.plays.length ?? 0,
    loads: window.__scMock?.loads.length ?? 0,
  }));
  if (afterSpin.plays + afterSpin.loads < 1) {
    throw new Error("Enter/Spin did not start SoundCloud playback");
  }

  const playBtn = page.locator("[data-player-current]").getByRole("button", {
    name: /^(play|pause|retry play)$/i,
  });
  const playingAfterSpin = await page.locator("[data-player-playing='true']").count();
  if (playingAfterSpin) {
    await playBtn.tap();
    await page.locator("[data-player-playing='false']").waitFor({ timeout: 3000 });
  }
  await page
    .locator("[data-player-current]")
    .getByRole("button", { name: /^(play|retry play)$/i })
    .tap();
  await page.locator("[data-player-playing='true']").waitFor({ timeout: 4000 });

  const cover = page.locator(`#work button[data-tablet-id]:not([data-tablet-id="${landedId}"])`).first();
  await cover.scrollIntoViewIfNeeded();
  const beforeCover = await page.evaluate(() => window.__scMock?.plays.length ?? 0);
  await cover.tap();
  await page.waitForFunction(
    (prev) => (window.__scMock?.plays.length ?? 0) + (window.__scMock?.loads.length ?? 0) > prev,
    beforeCover,
    { timeout: 4000 },
  );

  const verdict = {
    ok: true,
    url,
    landedId,
    playerId,
    afterSpin,
    afterCover: await page.evaluate(() => ({
      plays: window.__scMock?.plays.length ?? 0,
      loads: window.__scMock?.loads.length ?? 0,
      current: document.querySelector("[data-player-current]")?.getAttribute("data-player-current"),
    })),
  };
  console.log(JSON.stringify(verdict, null, 2));
} catch (err) {
  fail(String(err?.message || err));
} finally {
  await browser?.close();
}
