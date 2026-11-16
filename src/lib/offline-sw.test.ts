import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SW_BYPASS_PREFIXES,
  SW_PRECACHE,
  SW_SCRIPT_URL,
  SW_SHELL_URL,
  SW_STATIC_CACHE,
  swCacheIsStale,
  swClassifyRequest,
  swPathIsBypassed,
} from "./offline-sw.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const origin = "https://atmanmusic.app";

describe("service worker request policy", () => {
  it("bypasses Range so native seeking is untouched", () => {
    assert.equal(
      swClassifyRequest({
        method: "GET",
        url: `${origin}/media/streams/awake.mp3?sig=1`,
        origin,
        hasRange: true,
      }),
      "bypass",
    );
  });

  it("never intercepts stream, HQ, master, auth, admin, login, download or API", () => {
    const banned = [
      "/api/stream/awake",
      "/api/masters/download",
      "/api/stripe/webhook",
      "/api/auth/session",
      "/auth/popup",
      "/admin",
      "/admin/queue",
      "/login",
      "/download?session_id=x",
      "/media/streams/awake.mp3",
      "/media/streams-hq/awake.mp3",
      "/masters/awake.mp3",
      SW_SCRIPT_URL,
    ];
    for (const path of banned) {
      assert.equal(swPathIsBypassed(new URL(path, origin).pathname) || path === SW_SCRIPT_URL, true, path);
      assert.equal(
        swClassifyRequest({ method: "GET", url: `${origin}${path}`, origin, hasRange: false }),
        "bypass",
        path,
      );
    }
  });

  it("does not intercept POST, cross-origin SoundCloud, or Stripe hosts", () => {
    assert.equal(
      swClassifyRequest({ method: "POST", url: `${origin}/`, origin, hasRange: false, mode: "navigate" }),
      "ignore",
    );
    assert.equal(
      swClassifyRequest({
        method: "GET",
        url: "https://w.soundcloud.com/player/api.js",
        origin,
        hasRange: false,
      }),
      "bypass",
    );
  });

  it("treats documents as navigations and hashed assets as static", () => {
    assert.equal(
      swClassifyRequest({ method: "GET", url: `${origin}/`, origin, hasRange: false, mode: "navigate" }),
      "navigate",
    );
    assert.equal(
      swClassifyRequest({
        method: "GET",
        url: `${origin}/assets/app-abc.js`,
        origin,
        hasRange: false,
      }),
      "static",
    );
  });

  it("only deletes previous atman-offline-* caches", () => {
    assert.equal(swCacheIsStale("atman-offline-static-v0", [SW_STATIC_CACHE]), true);
    assert.equal(swCacheIsStale(SW_STATIC_CACHE, [SW_STATIC_CACHE]), false);
    assert.equal(swCacheIsStale("workbox-precache", [SW_STATIC_CACHE]), false);
  });
});

describe("public/sw.js stays aligned with the policy module", () => {
  const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");

  it("lists every bypass prefix and the public shell", () => {
    for (const prefix of SW_BYPASS_PREFIXES) {
      assert.ok(sw.includes(`"${prefix}"`), prefix);
    }
    for (const url of SW_PRECACHE) {
      assert.ok(sw.includes(`"${url}"`), url);
    }
    assert.ok(sw.includes(`"${SW_SHELL_URL}"`));
  });

  it("does not cache HTML navigations, and never intercepts Range", () => {
    assert.match(sw, /headers\.has\("range"\)/);
    assert.match(sw, /request\.mode === "navigate"/);
    assert.match(sw, /fetch\(event\.request\)\.catch/);
    assert.doesNotMatch(sw, /cache\.put\(event\.request.*navigate|navigate[\s\S]{0,200}cache\.put/);
    assert.doesNotMatch(sw, /location\.reload/);
    assert.doesNotMatch(sw, /cache\.(?:put|addAll)\([^)]*\/api\/stream/);
  });

  it("does not cache paid-master or HQ prefixes as static assets", () => {
    assert.match(sw, /\/media\/streams-hq\//);
    assert.match(sw, /\/masters\//);
    assert.match(sw, /IndexedDB/);
  });
});
