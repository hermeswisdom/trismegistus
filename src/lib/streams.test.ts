import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  nextPlayable,
  classifyPlayRejection,
  hasStream,
  mediaArtwork,
  nativeAudioAllowed,
  pickBackend,
  popHistoryTo,
  pushHistory,
  resolvePrevious,
  streamBlobPath,
  streamUrl,
} from "./streams.ts";
import { STREAM_SLUGS } from "./stream-manifest.ts";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";

const withMaster = SOUNDCLOUD_TRACKS.filter((t) => "downloadKey" in t && t.downloadKey);
const withoutMaster = SOUNDCLOUD_TRACKS.filter((t) => !("downloadKey" in t) || !t.downloadKey);

describe("stream manifest", () => {
  it("has a stream for every tablet with a master, and only those", () => {
    const masters = withMaster.map((t) => (t as { downloadKey: string }).downloadKey.replace(/^masters\/|\.mp3$/g, ""));
    assert.deepEqual([...STREAM_SLUGS].sort(), [...masters].sort());
  });
  it("tablets without a master stay on SoundCloud", () => {
    assert.ok(withoutMaster.length > 0);
    for (const t of withoutMaster) {
      assert.equal(hasStream(t.slug), false);
      assert.equal(pickBackend({ slug: t.slug, allowNative: true }), "sc");
    }
  });
});

describe("stream URLs", () => {
  it("points the player at our own route, never at masters/", () => {
    const slug = STREAM_SLUGS[0];
    assert.equal(streamUrl(slug), `/api/stream/${slug}`);
    assert.equal(streamBlobPath(slug), `streams/${slug}.mp3`);
    assert.equal(streamUrl("not-a-track"), null);
  });
  it("rejects anything that is not a known slug", () => {
    for (const bad of ["../masters/awake", "masters/awake", "AWAKE", "", null, undefined, "awake.mp3"]) {
      assert.equal(streamBlobPath(bad as string), null, String(bad));
    }
  });
});

describe("backend choice", () => {
  const slug = STREAM_SLUGS[0];
  it("native when a stream exists", () => {
    assert.equal(pickBackend({ slug, allowNative: true }), "native");
  });
  it("?player=sc and failed streams fall back to SoundCloud", () => {
    assert.equal(nativeAudioAllowed("?player=sc"), false);
    assert.equal(nativeAudioAllowed("?qc=1"), true);
    assert.equal(pickBackend({ slug, allowNative: false }), "sc");
    assert.equal(pickBackend({ slug, allowNative: true, failed: new Set([slug]) }), "sc");
  });
  it("play() rejections", () => {
    assert.equal(classifyPlayRejection("NotAllowedError"), "blocked");
    assert.equal(classifyPlayRejection("AbortError"), "ignore");
    assert.equal(classifyPlayRejection("NotSupportedError"), "fallback");
    assert.equal(classifyPlayRejection(undefined), "fallback");
  });
});

describe("previous track", () => {
  const order = ["a", "b", "c", "d"];
  it("restarts when a few seconds in", () => {
    assert.deepEqual(resolvePrevious({ elapsed: 12, history: ["a"], currentId: "c", order }), { action: "restart" });
  });
  it("goes back through history (wheel landings included)", () => {
    assert.deepEqual(resolvePrevious({ elapsed: 1, history: ["d", "a", "c"], currentId: "c", order }), { action: "play", id: "a" });
  });
  it("falls back to the tracklist order, wrapping", () => {
    assert.deepEqual(resolvePrevious({ elapsed: 0, history: [], currentId: "c", order }), { action: "play", id: "b" });
    assert.deepEqual(resolvePrevious({ elapsed: 0, history: ["a"], currentId: "a", order }), { action: "play", id: "d" });
  });
  it("history bookkeeping", () => {
    assert.deepEqual(pushHistory(["a"], "a"), ["a"]);
    assert.deepEqual(pushHistory(["a"], "b"), ["a", "b"]);
    assert.equal(pushHistory(Array.from({ length: 30 }, (_, i) => `t${i}`), "x").length, 30);
    assert.deepEqual(popHistoryTo(["a", "b", "c"], "b"), ["a"]);
  });
});

describe("media artwork", () => {
  it("makes cover paths absolute", () => {
    assert.equal(mediaArtwork("/images/tracks/awake.jpg", "https://atmanmusic.app/")[0].src, "https://atmanmusic.app/images/tracks/awake.jpg");
    assert.equal(mediaArtwork("https://cdn.x/a.jpg", "https://atmanmusic.app")[0].src, "https://cdn.x/a.jpg");
  });
});

describe("nextPlayable", () => {
  const order = [
    { id: "a", slug: "a" },
    { id: "b", slug: "b" },
    { id: "c", slug: "c" },
  ];
  it("skips tablets the native player cannot play", () => {
    assert.equal(nextPlayable(order, "a", (s) => s !== "b"), "c");
    assert.equal(nextPlayable(order, "c", () => true), "a");
  });
  it("falls back to the plain next tablet when nothing else is playable", () => {
    assert.equal(nextPlayable(order, "a", () => false), "b");
    assert.equal(nextPlayable([], "a", () => true), undefined);
  });
});

describe("pickRandomPlayable (wheel winner)", () => {
  const pool = [
    { id: "a", slug: "a" },
    { id: "b", slug: "b" },
    { id: "c", slug: "c" },
  ];
  it("only picks playable tablets, never the current one", async () => {
    const { pickRandomPlayable } = await import("./streams.ts");
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const t = pickRandomPlayable(pool, { except: "a", playable: (x) => x.id !== "b", random: () => r });
      assert.equal(t?.id, "c");
    }
  });
  it("falls back to any other tablet when none is playable", async () => {
    const { pickRandomPlayable } = await import("./streams.ts");
    assert.equal(pickRandomPlayable(pool, { except: "a", playable: () => false, random: () => 0 })?.id, "b");
    assert.equal(pickRandomPlayable([], {}), undefined);
  });
  it("no current-track exclusion when the pool has one tablet", async () => {
    const { pickRandomPlayable } = await import("./streams.ts");
    assert.equal(pickRandomPlayable([pool[0]], { except: "a" })?.id, "a");
  });
  it("on the real catalogue, the wheel never lands on a no-stream tablet", async () => {
    const { pickRandomPlayable, hasStream } = await import("./streams.ts");
    const { SOUNDCLOUD_TRACKS } = await import("./soundcloud-tracks.ts");
    const noStream = SOUNDCLOUD_TRACKS.filter((t) => !hasStream(t.slug)).map((t) => t.id);
    assert.ok(noStream.length > 0);
    for (let i = 0; i < SOUNDCLOUD_TRACKS.length; i++) {
      const t = pickRandomPlayable(SOUNDCLOUD_TRACKS, { playable: (x) => hasStream(x.slug), random: () => i / SOUNDCLOUD_TRACKS.length });
      assert.ok(t && !noStream.includes(t.id), t?.id);
    }
  });
});
