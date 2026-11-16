import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SW_AUDIO_CACHE,
  SW_BYPASS_PREFIXES,
  SW_PRECACHE,
  SW_SCRIPT_URL,
  SW_SHELL_URL,
  SW_STATIC_CACHE,
  buildCachedAudioRangeResponse,
  isCacheableResponse,
  isOpaqueResponse,
  parseByteRange,
  swCacheIsStale,
  swClassifyRequest,
  swPathIsBypassed,
  swPathIsSavedAudio,
} from "./offline-sw.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const origin = "https://atmanmusic.app";

describe("service worker request policy", () => {
  it("bypasses Range on live CDN streams so native seeking is untouched", () => {
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

  it("classifies saved listening copies as saved-audio, including Range", () => {
    assert.equal(swPathIsSavedAudio("/api/stream/awake"), true);
    assert.equal(swPathIsSavedAudio("/api/stream/awake", "?hq=1"), false);
    assert.equal(
      swClassifyRequest({
        method: "GET",
        url: `${origin}/api/stream/awake`,
        origin,
        hasRange: true,
      }),
      "saved-audio",
    );
    assert.equal(
      swClassifyRequest({
        method: "HEAD",
        url: `${origin}/api/stream/awake`,
        origin,
        hasRange: false,
      }),
      "saved-audio",
    );
    assert.equal(
      swClassifyRequest({
        method: "GET",
        url: `${origin}/api/stream/awake?hq=1`,
        origin,
        hasRange: true,
      }),
      "bypass",
    );
  });

  it("never intercepts HQ, master, auth, admin, login, download or live CDN streams", () => {
    const banned = [
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
    // /api/stream/<slug> is still a bypass prefix (live fetches), but classify
    // serves a Cache Storage hit with Range 206. A miss is fetched through.
    assert.equal(swPathIsBypassed("/api/stream/awake"), true);
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

  it("only deletes previous atman-offline-* caches, and keeps the audio cache", () => {
    assert.equal(swCacheIsStale("atman-offline-static-v0", [SW_STATIC_CACHE]), true);
    assert.equal(swCacheIsStale(SW_STATIC_CACHE, [SW_STATIC_CACHE]), false);
    assert.equal(swCacheIsStale("workbox-precache", [SW_STATIC_CACHE]), false);
    assert.equal(swCacheIsStale(SW_AUDIO_CACHE), false);
  });
});

describe("cached audio Range 206", () => {
  const bytes = Uint8Array.from({ length: 100 }, (_, i) => i);

  it("parses Safari's probe, open-end, and suffix ranges", () => {
    assert.deepEqual(parseByteRange("bytes=0-1", 100), { start: 0, end: 1 });
    assert.deepEqual(parseByteRange("bytes=50-", 100), { start: 50, end: 99 });
    assert.deepEqual(parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
    assert.equal(parseByteRange("bytes=200-300", 100), "unsatisfiable");
    assert.equal(parseByteRange(null, 100), null);
    assert.equal(parseByteRange("bytes=0-1,2-3", 100), null);
  });

  it("answers Range with a sliced 206 body, Content-Range, and Accept-Ranges", async () => {
    const res = buildCachedAudioRangeResponse({
      bytes,
      contentType: "audio/mpeg",
      rangeHeader: "bytes=0-1",
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("Accept-Ranges"), "bytes");
    assert.equal(res.headers.get("Content-Range"), "bytes 0-1/100");
    assert.equal(res.headers.get("Content-Length"), "2");
    assert.equal(res.headers.get("Content-Type"), "audio/mpeg");
    const body = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...body], [0, 1]);
  });

  it("returns 416 for an unsatisfiable range and 200 with Accept-Ranges when there is no Range", async () => {
    const miss = buildCachedAudioRangeResponse({ bytes, rangeHeader: "bytes=500-600" });
    assert.equal(miss.status, 416);
    assert.equal(miss.headers.get("Content-Range"), "bytes */100");
    const full = buildCachedAudioRangeResponse({ bytes, contentType: "audio/mpeg" });
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("Accept-Ranges"), "bytes");
    assert.equal(full.headers.get("Content-Length"), "100");
    assert.equal((await full.arrayBuffer()).byteLength, 100);
  });

  it("HEAD carries 206 headers without a body", async () => {
    const res = buildCachedAudioRangeResponse({
      bytes,
      rangeHeader: "bytes=10-19",
      method: "HEAD",
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("Content-Range"), "bytes 10-19/100");
    assert.equal((await res.arrayBuffer()).byteLength, 0);
  });

  it("refuses opaque responses for cache writes", () => {
    assert.equal(isOpaqueResponse({ type: "opaque", status: 0 }), true);
    assert.equal(isOpaqueResponse({ type: "opaqueredirect" }), true);
    assert.equal(isCacheableResponse({ ok: true, type: "opaque" }), false);
    assert.equal(isCacheableResponse({ ok: true, type: "basic", status: 200 }), true);
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

  it("does not cache HTML navigations, and only intercepts Range for saved audio", () => {
    assert.match(sw, /headers\.has\("range"\)/);
    assert.match(sw, /request\.mode === "navigate"/);
    assert.match(sw, /fetch\(event\.request\)\.catch/);
    assert.match(sw, /status: 206/);
    assert.match(sw, /Content-Range/);
    assert.match(sw, /atman-offline-audio-v1/);
    assert.match(sw, /opaque/);
    assert.doesNotMatch(sw, /cache\.put\(event\.request.*navigate|navigate[\s\S]{0,200}cache\.put/);
    assert.doesNotMatch(sw, /location\.reload/);
    assert.doesNotMatch(sw, /cache\.(?:put|addAll)\([^)]*\/api\/stream/);
  });

  it("does not cache paid-master or HQ prefixes as static assets", () => {
    assert.match(sw, /\/media\/streams-hq\//);
    assert.match(sw, /\/masters\//);
    assert.match(sw, /AUDIO_CACHE/);
  });
});
