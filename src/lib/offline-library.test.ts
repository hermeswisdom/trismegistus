import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { STREAM_SLUGS } from "./stream-manifest.ts";
import {
  classifySaveError,
  coerceAudioBlob,
  downloadListeningAudio,
  dropOfflineSave,
  estimateOfflineUsage,
  formatOfflineBytes,
  formatStorageLine,
  hydrateOfflineSaves,
  isAllowedOfflineSource,
  isForbiddenOfflineSource,
  listeningStreamPath,
  looksLikeAudio,
  memoryOfflineBackend,
  persistOfflineSave,
  resetOfflineObjectUrlsForTests,
  saveErrorCopy,
  shouldRecordListen,
  peekOfflineObjectUrl,
} from "./offline-library.ts";

const SLUG = STREAM_SLUGS[0]!;

function audioBlob(bytes = 64): Blob {
  return new Blob([new Uint8Array(bytes).fill(1)], { type: "audio/mpeg" });
}

describe("offline source policy", () => {
  it("allows listening streams and same-origin /media/streams paths", () => {
    assert.equal(isAllowedOfflineSource(`/api/stream/${SLUG}`), true);
    assert.equal(isAllowedOfflineSource(`https://atmanmusic.app/api/stream/${SLUG}`), true);
    assert.equal(isAllowedOfflineSource(`https://atmanmusic.app/media/streams/${SLUG}.mp3?sig=1`), true);
    assert.equal(
      isAllowedOfflineSource(`https://abc.private.blob.vercel-storage.com/streams/${SLUG}.mp3?sig=1`),
      true,
    );
  });

  it("never allows paid masters, HQ Auto Mix, Stripe, admin or download routes", () => {
    const banned = [
      `https://abc.private.blob.vercel-storage.com/masters/${SLUG}.mp3`,
      `/api/masters/download?slug=${SLUG}`,
      "/api/stripe/webhook",
      "/download?session_id=cs_test",
      "/admin",
      "/api/auth/session",
      `https://atmanmusic.app/media/streams-hq/${SLUG}.mp3`,
      `https://abc.private.blob.vercel-storage.com/streams-hq/${SLUG}.mp3`,
    ];
    for (const url of banned) {
      assert.equal(isForbiddenOfflineSource(url), true, url);
      assert.equal(isAllowedOfflineSource(url), false, url);
    }
  });

  it("listening path is the 128k route, never hq or masters", () => {
    assert.equal(listeningStreamPath(SLUG), `/api/stream/${SLUG}`);
    assert.equal(listeningStreamPath("lift-me-up"), null);
    assert.doesNotMatch(listeningStreamPath(SLUG) ?? "", /hq|masters/);
  });

  it("rejects HTML/JSON bodies posing as audio", () => {
    assert.equal(looksLikeAudio("text/html", `/api/stream/${SLUG}`), false);
    assert.equal(looksLikeAudio("application/json", `/api/stream/${SLUG}`), false);
    assert.equal(looksLikeAudio("audio/mpeg", `/api/stream/${SLUG}`), true);
    assert.equal(looksLikeAudio("application/octet-stream", `/media/streams/${SLUG}.mp3`), true);
  });

  it("coerces IDB audio values into playable blobs", () => {
    const fromBlob = coerceAudioBlob(audioBlob(12));
    assert.equal(fromBlob?.size, 12);
    const fromBuffer = coerceAudioBlob(new Uint8Array([1, 2, 3, 4]).buffer);
    assert.equal(fromBuffer?.size, 4);
    assert.equal(coerceAudioBlob(new Uint8Array(0)), undefined);
  });
});

describe("save errors", () => {
  it("classifies quota, abort, network and unsupported honestly", () => {
    assert.equal(classifySaveError({ name: "QuotaExceededError" }), "quota");
    assert.equal(classifySaveError({ name: "AbortError" }), "interrupted");
    assert.equal(classifySaveError({ name: "TypeError", message: "Failed to fetch" }), "network");
    assert.equal(classifySaveError({ name: "TypeError", message: "Cannot read properties of null" }), "unknown");
    assert.equal(classifySaveError({ name: "UnsupportedError" }), "unsupported");
    assert.equal(saveErrorCopy("quota"), "Not enough space on this device.");
    assert.equal(saveErrorCopy("interrupted"), "Save interrupted. Try again.");
    assert.equal(saveErrorCopy("evicted"), "This save was cleared from the device. Save it again while you're online.");
  });

  it("does not record listens while offline or in QC", () => {
    assert.equal(shouldRecordListen({ online: true, qc: false }), true);
    assert.equal(shouldRecordListen({ online: false, qc: false }), false);
    assert.equal(shouldRecordListen({ online: true, qc: true }), false);
    assert.equal(shouldRecordListen({ online: undefined, qc: false }), true);
  });
});

describe("downloadListeningAudio", () => {
  it("stores the redirected 128k body and refuses a master Location", async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const result = await downloadListeningAudio({
      slug: SLUG,
      fetch: async (input) => {
        assert.equal(String(input), `/api/stream/${SLUG}`);
        const res = new Response(body, {
          status: 200,
          headers: { "content-type": "audio/mpeg", "content-length": "4" },
        });
        Object.defineProperty(res, "url", { value: `https://atmanmusic.app/media/streams/${SLUG}.mp3?sig=1` });
        return res;
      },
    });
    assert.equal(result.bytes, 4);
    assert.equal(result.contentType, "audio/mpeg");
    assert.equal(result.blob.type, "audio/mpeg");
  });

  it("rejects a redirect onto masters/", async () => {
    await assert.rejects(
      () =>
        downloadListeningAudio({
          slug: SLUG,
          fetch: async () => {
            const res = new Response(new Uint8Array([1]), {
              status: 200,
              headers: { "content-type": "audio/mpeg" },
            });
            Object.defineProperty(res, "url", {
              value: `https://store.private.blob.vercel-storage.com/masters/${SLUG}.mp3`,
            });
            return res;
          },
        }),
      (err: unknown) => classifySaveError(err) === "forbidden",
    );
  });

  it("treats abort as interrupted and does not return a blob", async () => {
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
      () => downloadListeningAudio({ slug: SLUG, fetch: async () => new Response(null, { status: 200 }), signal: abort.signal }),
      (err: unknown) => classifySaveError(err) === "interrupted",
    );
  });

  it("refuses tablets with no listening stream", async () => {
    await assert.rejects(
      () => downloadListeningAudio({ slug: "lift-me-up", fetch: async () => new Response(null) }),
      (err: unknown) => classifySaveError(err) === "no-stream",
    );
  });

  it("binds fetch so an unbound window.fetch-like function still runs", async () => {
    const body = new Uint8Array([9, 8, 7]);
    async function unboundFetch(this: unknown, input: unknown) {
      if (this == null) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      assert.equal(String(input), `/api/stream/${SLUG}`);
      const res = new Response(body, { status: 200, headers: { "content-type": "audio/mpeg" } });
      Object.defineProperty(res, "url", { value: `https://atmanmusic.app/api/stream/${SLUG}` });
      return res;
    }
    const result = await downloadListeningAudio({ slug: SLUG, fetch: unboundFetch as typeof fetch });
    assert.equal(result.bytes, 3);
  });
});

describe("IndexedDB-shaped backend", () => {
  it("persists a save, hydrates an object URL, and drops missing audio as eviction", async () => {
    resetOfflineObjectUrlsForTests();
    const backend = memoryOfflineBackend();
    const row = await persistOfflineSave(
      backend,
      { id: SLUG, slug: SLUG, title: "Test", image: `/images/tracks/${SLUG}.jpg` },
      { blob: audioBlob(80), bytes: 80, contentType: "audio/mpeg" },
    );
    assert.equal(row.bitrateKbps, 128);
    assert.ok(peekOfflineObjectUrl(SLUG)?.startsWith("blob:"));
    const hydrated = await hydrateOfflineSaves(backend);
    assert.equal(hydrated.items.length, 1);
    assert.equal(hydrated.missing.length, 0);

    backend.audio.delete(SLUG);
    resetOfflineObjectUrlsForTests();
    const after = await hydrateOfflineSaves(backend);
    assert.equal(after.items.length, 0);
    assert.deepEqual(after.missing, [SLUG]);
    assert.equal(backend.meta.has(SLUG), false);
  });

  it("cleans a partial write on quota failure", async () => {
    const backend = memoryOfflineBackend();
    const inner = backend.putMeta.bind(backend);
    backend.putMeta = async () => {
      throw Object.assign(new Error("full"), { name: "QuotaExceededError" });
    };
    await assert.rejects(
      () =>
        persistOfflineSave(
          backend,
          { id: SLUG, slug: SLUG, title: "Test", image: "/x.jpg" },
          { blob: audioBlob(), bytes: 64, contentType: "audio/mpeg" },
        ),
      (err: unknown) => classifySaveError(err) === "quota",
    );
    backend.putMeta = inner;
    assert.equal(backend.audio.has(SLUG), false);
    assert.equal(backend.meta.has(SLUG), false);
  });

  it("remove drops audio and the object URL", async () => {
    resetOfflineObjectUrlsForTests();
    const backend = memoryOfflineBackend();
    await persistOfflineSave(
      backend,
      { id: SLUG, slug: SLUG, title: "Test", image: "/x.jpg" },
      { blob: audioBlob(), bytes: 64, contentType: "audio/mpeg" },
    );
    await dropOfflineSave(backend, SLUG);
    assert.equal(peekOfflineObjectUrl(SLUG), null);
    assert.equal(backend.audio.has(SLUG), false);
  });
});

describe("storage copy", () => {
  it("formats bytes and an honest quota line", () => {
    assert.equal(formatOfflineBytes(3600_000), "3.6 MB");
    assert.match(formatStorageLine({ used: 3600_000, quota: 50_000_000, count: 1 }), /1 song/);
    assert.match(formatStorageLine({ used: 1000, quota: null, count: 2 }), /2 songs/);
  });

  it("falls back to summed file sizes when estimate() is missing", async () => {
    const usage = await estimateOfflineUsage(null, [{ bytes: 1000 } as never, { bytes: 500 } as never]);
    assert.equal(usage.used, 1500);
    assert.equal(usage.quota, null);
  });
});

describe("offline shell keeps the same IndexedDB names", () => {
  it("offline.html talks to atman-offline / saves / audio / covers", () => {
    const html = readFileSync(new URL("../../public/offline.html", import.meta.url), "utf8");
    assert.match(html, /const DB = "atman-offline"/);
    assert.match(html, /const SAVES = "saves"/);
    assert.match(html, /const AUDIO = "audio"/);
    assert.match(html, /const COVERS = "covers"/);
    assert.match(html, /listening copy/);
    assert.match(html, /not the £0\.99 master/i);
    assert.match(html, /function asAudioBlob/);
    assert.doesNotMatch(html, /\/api\/masters|streams-hq/);
  });
});
