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
  window.__ATMAN_SPIN_MS = 1800;
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
  await page.locator("[data-enter-gate][data-gate-ready='true']").waitFor({ state: "attached" });
  await enter.waitFor({ state: "visible" });
  await enter.click();
  const afterEnterCopy = await page.evaluate(() => ({
    noTablet: document.body.innerText.includes("No tablet yet."),
    turning: Boolean(document.querySelector("[data-wheel-turning]")),
    player: document.querySelector("[data-player-current]")?.getAttribute("data-player-current"),
  }));
  if (afterEnterCopy.noTablet) {
    throw new Error(`Enter left No tablet yet: ${JSON.stringify(afterEnterCopy)}`);
  }
  if (afterEnterCopy.player === "the-sleepers-waking") {
    throw new Error(`Enter kept the featured tablet instead of spinning: ${JSON.stringify(afterEnterCopy)}`);
  }
  try {
    await page.locator("[data-wheel-landed]").waitFor({ state: "attached", timeout: 8000 });
  } catch (err) {
    const dump = await page.evaluate(() => ({
      spinning: document.querySelector("[data-wheel-disc]")?.getAttribute("data-wheel-spinning"),
      transform: document.querySelector("[data-wheel-disc]")?.getAttribute("style"),
      firstSpin: localStorage.getItem("trismegistus-first-spin"),
      turning: document.body.innerText.includes("The wheel is turning."),
      noTablet: document.body.innerText.includes("No tablet yet."),
      player: document.querySelector("[data-player-current]")?.getAttribute("data-player-current"),
      playing: document.querySelector("[data-player-playing]")?.getAttribute("data-player-playing"),
      gate: document.querySelector("[data-enter-gate]")?.className.includes("invisible"),
      mock: window.__scMock,
    }));
    throw new Error(`${String(err?.message || err)} dump=${JSON.stringify(dump)}`);
  }
  await page.locator("[data-wheel-spinning='false']").waitFor({ state: "attached", timeout: 2000 });

  const rotation = await page.locator("[data-wheel-disc]").evaluate((el) => {
    const inline = el.style.transform || "";
    const deg = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(inline);
    const spinning = el.getAttribute("data-wheel-spinning");
    return { inline, deg: deg ? Number(deg[1]) : null, spinning };
  });
  if (rotation.deg === null || Math.abs(rotation.deg) < 360) {
    throw new Error(`wheel did not turn a full rotation: ${JSON.stringify(rotation)}`);
  }

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

  const faceAfterSpin = await page.locator("[data-player-current]").getAttribute("data-player-face");
  if (faceAfterSpin !== "pause" && faceAfterSpin !== "pending") {
    throw new Error(`dock did not show Pause/pending after Enter: face=${faceAfterSpin}`);
  }
  await page.locator("[data-player-current]").getByRole("button", { name: /^pause$/i }).waitFor({ timeout: 3000 });

  const glow = await page.evaluate(() => {
    const el = document.querySelector("[data-atman]");
    return {
      mode: el?.getAttribute("data-atman") ?? null,
      hasCore: Boolean(el),
    };
  });
  if (!glow.hasCore || glow.mode === "idle") {
    throw new Error(`ATMAN did not leave idle after play: ${JSON.stringify(glow)}`);
  }

  const rain = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("[data-rain]")];
    const hero = document.querySelector("#top");
    const heroBox = hero?.getBoundingClientRect();
    return canvases
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return false;
        return el.getAttribute("data-rain-paused") !== "true";
      })
      .map((el) => {
        const box = el.getBoundingClientRect();
        return {
          cols: Number(el.getAttribute("data-rain-cols") || 0),
          phone: el.getAttribute("data-rain-phone"),
          height: Math.round(box.height),
          overflowY: heroBox ? box.bottom > heroBox.bottom + 12 : null,
          overflowX: heroBox ? box.right > heroBox.right + 12 : null,
        };
      });
  });
  const flooding = rain.filter((row) => row.overflowY || row.overflowX || row.cols > 12);
  if (flooding.length) {
    throw new Error(`notes rain not contained on phone: ${JSON.stringify({ rain, flooding })}`);
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
  await page.locator("[data-player-current]").getByRole("button", { name: /^pause$/i }).waitFor({ timeout: 2000 });
  const faceAfterPlay = await page.locator("[data-player-current]").getAttribute("data-player-face");
  if (faceAfterPlay !== "pause" && faceAfterPlay !== "pending") {
    throw new Error(`Play tap did not show Pause: face=${faceAfterPlay}`);
  }

  const cover = page.locator(`#work button[data-tablet-id]:not([data-tablet-id="${landedId}"])`).first();
  await cover.scrollIntoViewIfNeeded();
  const beforeCover = await page.evaluate(
    () => (window.__scMock?.plays.length ?? 0) + (window.__scMock?.loads.length ?? 0),
  );
  await cover.tap();
  await page.waitForFunction(
    (prev) => (window.__scMock?.plays.length ?? 0) + (window.__scMock?.loads.length ?? 0) > prev,
    beforeCover,
    { timeout: 4000 },
  );

  const afterCover = await page.evaluate(() => ({
      plays: window.__scMock?.plays.length ?? 0,
      loads: window.__scMock?.loads.length ?? 0,
      current: document.querySelector("[data-player-current]")?.getAttribute("data-player-current"),
    }));
    if (afterCover.current === landedId) {
      throw new Error("cover tap did not change the selected tablet");
    }

    await context.close();

    const returning = await browser.newContext({
      ...iphone,
      hasTouch: true,
      isMobile: true,
    });
    await returning.addInitScript(MOCK_SC);
    await returning.addInitScript(() => {
      try {
        localStorage.setItem("trismegistus-first-spin", "1");
      } catch {}
    });
    const page2 = await returning.newPage();
    page2.setDefaultTimeout(timeoutMs);
    await page2.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page2.locator("[data-enter-gate][data-gate-ready='true']").waitFor({ state: "attached" });
    await page2.getByRole("button", { name: /^enter$/i }).click();
    await page2.locator("[data-wheel-landed]").waitFor({ state: "attached", timeout: 8000 });
    const returningLanded = await page2.locator("[data-wheel-landed]").getAttribute("data-wheel-landed");
    const returningPlayer = await page2.locator("[data-player-current]").getAttribute("data-player-current");
    const returningCopy = await page2.evaluate(() =>
      document.body.innerText.includes("No tablet yet."),
    );
    if (!returningLanded || returningLanded !== returningPlayer) {
      throw new Error(
        `returning Enter did not spin-to-select (landed=${returningLanded} player=${returningPlayer})`,
      );
    }
    if (returningCopy) {
      throw new Error("returning Enter left No tablet yet");
    }
    if (returningPlayer === "the-sleepers-waking") {
      throw new Error("returning Enter kept the featured tablet instead of spinning");
    }
    await returning.close();

    const verdict = {
    ok: true,
    url,
    rotation,
    landedId,
    playerId,
    afterSpin,
    afterCover,
    returning: { landed: returningLanded, player: returningPlayer },
  };
  console.log(JSON.stringify(verdict, null, 2));
} catch (err) {
  fail(String(err?.message || err));
} finally {
  await browser?.close();
}
