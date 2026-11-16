#!/usr/bin/env node
/**
 * Playwright WebKit + iPhone profile evidence for offline saved songs.
 * Distinguishes this from unverified physical iPhone Safari / lock-screen.
 *
 *   node scripts/offline-listen-webkit-qc.mjs [url]
 *
 * Never pointed at atmanmusic.app — preview (or local) only.
 */
import { writeFileSync } from "node:fs";
import { webkit, devices } from "playwright";

const url = process.argv[2] || process.env.OFFLINE_QC_URL || "";
const timeoutMs = Number(process.env.OFFLINE_QC_TIMEOUT_MS || 90000);
const iphone = devices["iPhone 13"] ?? devices["iPhone 12"];

function assertPreviewHost(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error("Need a preview URL (never atmanmusic.app)");
  }
  if (/atmanmusic\.app$/i.test(parsed.hostname) || parsed.hostname === "atmanmusic.app") {
    throw new Error(`Refusing to test production host ${parsed.hostname}`);
  }
  if (!/[?&]qc=1(?:&|$)/.test(parsed.search) && !parsed.searchParams.has("qc")) {
    parsed.searchParams.set("qc", "1");
  }
  if (!parsed.searchParams.has("tablet")) parsed.searchParams.set("tablet", "the-sleepers-waking");
  return parsed.href;
}

const results = {
  ok: false,
  engine: "webkit",
  profile: iphone?.userAgent ? "iPhone 13" : "iPhone",
  lockScreen: "unverified (no physical iPhone/Safari)",
  steps: [],
};

if (!url) {
  results.error = "Pass the Vercel preview URL with ?qc=1";
  writeFileSync("/tmp/offline-listen-webkit-qc.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
}

const target = assertPreviewHost(url);
results.url = target;

let browser;
const consoleLines = [];
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...iphone,
    // Need the SW so Range 206 from Cache Storage is in the path.
    serviceWorkers: "allow",
  });
  const page = await context.newPage();
  page.on("console", (msg) => consoleLines.push(`${msg.type()}: ${msg.text()}`));
  page.on("pageerror", (err) => consoleLines.push(`pageerror: ${err.message}`));
  page.setDefaultTimeout(timeoutMs);

  await page.goto(target, { waitUntil: "domcontentloaded" });
  await page.locator("[data-enter-gate][data-gate-ready='true']").waitFor({ state: "attached" });
  const gateVisible = await page.locator("[data-enter-gate]").evaluate((el) => !el.className.includes("invisible"));
  if (gateVisible) await page.getByRole("button", { name: /^Enter$/i }).click();
  await page.locator("[data-save-variant=hero]").waitFor({ state: "visible" });

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
    throw new Error(`save ended ${saveState}: ${saveError}`);
  }
  results.steps.push({ name: "save offline reaches Saved", ok: true, slug: savingSlug });

  const rangeProbe = await page.evaluate(async (slug) => {
    const res = await fetch(`/api/stream/${slug}`, {
      headers: { Range: "bytes=0-1" },
      cache: "reload",
    });
    const buf = await res.arrayBuffer();
    return {
      status: res.status,
      range: res.headers.get("content-range"),
      accept: res.headers.get("accept-ranges"),
      bytes: buf.byteLength,
      type: res.headers.get("content-type"),
    };
  }, savingSlug);
  results.steps.push({
    name: "cached listening copy answers Range with 206",
    ok:
      rangeProbe.status === 206 &&
      rangeProbe.bytes === 2 &&
      /bytes 0-1\//.test(rangeProbe.range || "") &&
      !/master/i.test(rangeProbe.type || ""),
    ...rangeProbe,
  });

  await context.setOffline(true);

  const alreadyPlaying = await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return Boolean(el && !el.paused);
  });
  if (!alreadyPlaying) {
    await page.locator("[data-download-slug]").first().click();
  }
  await page.waitForFunction(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return Boolean(el && !el.paused && el.src && !/masters/.test(el.src));
  });
  await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    el.currentTime = 2;
  });
  await page.waitForFunction(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return el && el.currentTime >= 1.5;
  });
  const offlinePlay = await page.evaluate(() => {
    const el = document.querySelector("audio[data-atman-native-audio]");
    return { src: el?.src || "", time: el?.currentTime || 0, paused: Boolean(el?.paused) };
  });
  results.steps.push({
    name: "offline play + seek of the saved copy",
    ok: !offlinePlay.paused && offlinePlay.time >= 1.5 && !/masters/.test(offlinePlay.src),
    ...offlinePlay,
  });

  await context.setOffline(false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("[data-enter-gate][data-gate-ready='true']").waitFor({ state: "attached" });
  const gateAgain = await page.locator("[data-enter-gate]").evaluate((el) => !el.className.includes("invisible"));
  if (gateAgain) await page.getByRole("button", { name: /^Enter$/i }).click();
  await page.locator("[data-save-variant=hero]").waitFor({ state: "visible" });
  const afterReload = await page.evaluate(() => {
    const btn = document.querySelector("[data-save-variant=hero]");
    const shelf = document.querySelector("[data-downloads-shelf]");
    const row = document.querySelector("[data-download-slug]");
    return {
      saveState: btn?.getAttribute("data-save-state") || "",
      slug: btn?.getAttribute("data-save-offline") || "",
      hasShelf: Boolean(shelf),
      downloadSlug: row?.getAttribute("data-download-slug") || "",
    };
  });
  results.steps.push({
    name: "reload keeps Saved and the Downloads row",
    ok:
      afterReload.saveState === "saved" &&
      afterReload.hasShelf &&
      Boolean(afterReload.downloadSlug) &&
      afterReload.downloadSlug === savingSlug,
    ...afterReload,
  });

  results.ok = results.steps.every((s) => s.ok);
} catch (err) {
  results.error = err instanceof Error ? err.message : String(err);
  results.console = consoleLines.slice(-24);
  results.ok = false;
} finally {
  await browser?.close();
}

writeFileSync("/tmp/offline-listen-webkit-qc.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 1);
