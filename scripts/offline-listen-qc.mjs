#!/usr/bin/env node
/**
 * Chromium evidence for the offline-listening test build.
 * Distinguishes automated Chromium from unverified iPhone/Safari lock-screen.
 *
 *   node scripts/offline-listen-qc.mjs [url]
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const url = process.argv[2] || process.env.OFFLINE_QC_URL || "http://127.0.0.1:8080/?tablet=the-sleepers-waking&qc=1";
const timeoutMs = Number(process.env.OFFLINE_QC_TIMEOUT_MS || 60000);
const shotDir = process.env.OFFLINE_QC_SHOTS || "/opt/cursor/artifacts";

function mp3() {
  const made = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=120", "-b:a", "128k", "-f", "mp3", "pipe:1"],
    { encoding: "buffer", maxBuffer: 5_000_000 },
  );
  if (made.status !== 0 || !made.stdout?.length) {
    throw new Error(`ffmpeg failed: ${made.stderr?.toString() || made.status}`);
  }
  return made.stdout;
}

function shot(page, name) {
  try {
    mkdirSync(shotDir, { recursive: true });
    return page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true });
  } catch {
    return Promise.resolve();
  }
}

const results = { ok: false, engine: "chromium", lockScreen: "unverified (no physical iPhone/Safari)", steps: [] };
const audio = mp3();

let browser;
let consoleLines = [];
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    // Preview registers a SW that bypasses /api/stream and skips Playwright
    // routes. Block it so save/adopt use the stub; the shell is /offline.html.
    serviceWorkers: "block",
  });
  const requested = [];
  context.on("request", (req) => requested.push(req.url()));

  const fulfillAudio = (route) =>
    route.fulfill({
      status: 200,
      contentType: "audio/mpeg",
      body: audio,
    });
  const isStubAudio = (url) =>
    /\/api\/stream\/|\/media\/streams\/|vercel-storage\.com|\.mp3(?:$|\?)/i.test(url);

  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (isStubAudio(url) || route.request().resourceType() === "media") return fulfillAudio(route);
    return route.continue();
  });
  page.on("console", (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`pageerror: ${err.message}`));
  page.setDefaultTimeout(timeoutMs);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("[data-enter-gate][data-gate-ready='true']").waitFor({ state: "attached" });
  await page.getByRole("button", { name: /^Enter$/i }).click();
  await page.locator("[data-save-variant=hero]").waitFor({ state: "visible" });

  const onlineSrc = await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return el?.getAttribute("src") || el?.src || "";
  });
  results.steps.push({
    name: "online native src is the listening stream, not a master",
    src: onlineSrc,
    ok: /\/api\/stream\//.test(onlineSrc) && !/masters/.test(onlineSrc),
  });

  const saveBtn = page.locator("[data-save-variant=hero]").first();
  await saveBtn.scrollIntoViewIfNeeded();
  const savingSlug = await saveBtn.getAttribute("data-save-offline");
  await saveBtn.click();
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-save-variant=hero]");
    const state = el?.getAttribute("data-save-state");
    return state === "saved" || state === "error";
  }, null, { timeout: timeoutMs });
  const saveState = await saveBtn.getAttribute("data-save-state");
  const saveError = await page.locator("[data-save-error]").textContent().catch(() => "");
  if (saveState !== "saved") {
    const debug = await page.evaluate(async () => {
      const slug = document.querySelector("[data-save-variant=hero]")?.getAttribute("data-save-offline");
      try {
        const res = await fetch(`/api/stream/${slug}`, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "audio/mpeg, audio/*, application/octet-stream" },
        });
        const buf = await res.arrayBuffer();
        return { slug, status: res.status, url: res.url, bytes: buf.byteLength, type: res.headers.get("content-type"), idb: Boolean(indexedDB) };
      } catch (e) {
        return { slug, error: String(e), idb: Boolean(indexedDB) };
      }
    });
    throw new Error(`save ended ${saveState}: ${saveError} debug=${JSON.stringify(debug)}`);
  }
  results.steps.push({ name: "save offline reaches Saved", ok: true });
  const snap = await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return { src: el?.src || "", attr: el?.getAttribute("src") || "", paused: Boolean(el?.paused) };
  });
  results.steps.push({ name: "post-save native src snapshot", ok: /^blob:/.test(snap.src) || /^blob:/.test(snap.attr), ...snap });
  await page.waitForFunction(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return Boolean(el && /^blob:/.test(el.src || ""));
  }, null, { timeout: 20000 });
  const afterSave = await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return { src: el?.src || "", paused: Boolean(el?.paused), slug: el?.getAttribute("data-save-offline") || "" };
  });
  results.steps.push({
    name: "saving the currently playing track adopts blob src without changing tablet",
    ok: /^blob:/.test(afterSave.src) && !/masters/.test(afterSave.src) && !afterSave.paused,
    savingSlug,
    ...afterSave,
  });

  const probe = await page.evaluate(async () => {
    const res = await fetch("/api/stream/the-sleepers-waking", { cache: "no-store" });
    const buf = await res.arrayBuffer();
    return { status: res.status, type: res.headers.get("content-type"), bytes: buf.byteLength, url: res.url };
  });
  results.steps.push({ name: "stream probe", ok: probe.status === 200 && /audio|mpeg|octet/i.test(probe.type || "") && probe.bytes > 1000, ...probe });
  await shot(page, "offline-saved");

  // Rivet: airplane mode without switching tracks must keep the blob, not /api/stream.
  await context.setOffline(true);
  await page.waitForFunction(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return el && !el.paused && /^blob:/.test(el.src);
  });
  const mid = await page.evaluate(() => document.querySelector("audio[data-atman-native-audio]").currentTime);
  await page.evaluate(() => {
    document.querySelector("audio[data-atman-native-audio]").currentTime = 2;
  });
  await page.waitForFunction(() => document.querySelector("audio[data-atman-native-audio]").currentTime >= 1.5);
  const afterSeekOffline = await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return { src: el.src, time: el.currentTime, paused: el.paused };
  });
  results.steps.push({
    name: "same-track network cut after save still seeks the blob",
    ok: /^blob:/.test(afterSeekOffline.src) && afterSeekOffline.time >= 1.5 && afterSeekOffline.time !== mid && !afterSeekOffline.paused,
    mid,
    ...afterSeekOffline,
  });
  await context.setOffline(false);

  const forbiddenHit = requested.some((u) => /\/masters\/|\/api\/masters|\/api\/stripe|streams-hq/.test(u));
  results.steps.push({ name: "save never touched masters/stripe/HQ", ok: !forbiddenHit, sample: requested.filter((u) => /stream|master|stripe|hq/i.test(u)).slice(0, 8) });

  await page.locator("[data-downloads-shelf]").waitFor({ state: "visible" });
  const storage = await page.locator("[data-offline-storage]").textContent();
  results.steps.push({ name: "downloads list + storage line", ok: Boolean(storage && /song/i.test(storage)), storage });

  const alreadyBlob = await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return Boolean(el && !el.paused && /^blob:/.test(el.src || ""));
  });
  if (!alreadyBlob) {
    await page.locator("[data-download-slug]").first().click();
    await page.waitForFunction(() => {
      const el = document.querySelector("audio[data-atman-native-audio]");
      return el && !el.paused && /^blob:/.test(el.src || "");
    });
  }
  const before = await page.evaluate(() => document.querySelector("audio[data-atman-native-audio]").currentTime);
  await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    el.currentTime = 2;
  });
  await page.waitForFunction(() => document.querySelector("audio[data-atman-native-audio]").currentTime >= 1.5);
  const after = await page.evaluate(() => document.querySelector("audio[data-atman-native-audio]").currentTime);
  results.steps.push({ name: "saved blob playback + seek", ok: after >= 1.5 && after !== before, before, after });

  await context.setOffline(true);
  await page.waitForFunction(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return el && !el.paused && /^blob:/.test(el.src);
  });
  results.steps.push({ name: "keeps playing the blob after the network is cut", ok: true });

  await context.setOffline(false);
  const shellUrl = new URL("/offline.html", url);
  const share = new URL(url).searchParams.get("_vercel_share");
  if (share) shellUrl.searchParams.set("_vercel_share", share);
  await page.goto(shellUrl.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /offline|Downloads on this device/i.test(document.body.innerText));
  const shell = await page.evaluate(() => ({
    title: document.title,
    sw: Boolean(navigator.serviceWorker?.controller),
    body: document.body.innerText.slice(0, 240),
  }));
  results.steps.push({ name: "public offline.html shell lists the save", ok: /Downloads on this device/i.test(shell.body), shell });
  await shot(page, "offline-shell");

  await context.setOffline(true);
  await page.locator("button.play").first().click();
  await page.waitForFunction(() => {
    const el = document.querySelector("audio");
    return el && !el.paused && el.src.startsWith("blob:");
  });
  await page.evaluate(() => {
    const el = document.querySelector("audio");
    el.currentTime = 2.2;
  });
  await page.waitForFunction(() => document.querySelector("audio").currentTime >= 1.8);
  const shellSeek = await page.evaluate(() => document.querySelector("audio").currentTime);
  results.steps.push({ name: "offline shell play + seek", ok: shellSeek >= 1.8, shellSeek });

  await page.locator("button[data-act='remove'], button:has-text('Remove')").first().click();
  await page.waitForFunction(() => /No songs saved/i.test(document.body.innerText));
  results.steps.push({ name: "remove-download clears the shell list", ok: true });
  await shot(page, "offline-removed");

  await context.setOffline(false);
  const page2 = await context.newPage();
  let saveStarted = false;
  await page2.route("**/*", async (route) => {
    const url = route.request().url();
    if (!(/\/api\/stream\/|\/media\/streams\/|vercel-storage\.com|\.mp3(?:$|\?)/i.test(url) || route.request().resourceType() === "media")) {
      return route.continue();
    }
    saveStarted = true;
    await new Promise((r) => setTimeout(r, 8000));
    await route.abort("internetdisconnected");
  });
  await page2.goto(url, { waitUntil: "domcontentloaded" });
  await page2.locator("[data-enter-gate][data-gate-ready='true']").waitFor({ state: "attached" });
  const gateVisible = await page2.locator("[data-enter-gate]").evaluate((el) => !el.className.includes("invisible"));
  if (gateVisible) await page2.getByRole("button", { name: /^Enter$/i }).click();
  await page2.locator("[data-save-variant=hero]").waitFor({ state: "visible" });
  await page2.locator("[data-save-variant=hero]").click();
  await page2.waitForFunction(() => document.querySelector("[data-save-variant=hero]")?.getAttribute("data-save-state") === "saving");
  await page2.locator("[data-save-variant=hero]").click();
  await page2.waitForFunction(() => {
    const el = document.querySelector("[data-save-variant=hero]");
    return el?.getAttribute("data-save-state") === "error" && /interrupt/i.test(el.parentElement?.innerText || document.body.innerText);
  });
  results.steps.push({ name: "interrupted save is honest and not marked Saved", ok: saveStarted, saveStarted });
  await shot(page2, "offline-interrupted");

  results.ok = results.steps.every((s) => s.ok);
} catch (err) {
  results.error = err instanceof Error ? err.message : String(err);
  results.console = consoleLines.slice(-20);
  results.ok = false;
} finally {
  await browser?.close();
}

writeFileSync("/tmp/offline-listen-qc.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 1);
