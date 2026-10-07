import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canUseSoundCloud,
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
  streamFailureAction,
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

describe("wheelWinnerFilter: every tablet can win a normal spin", () => {
  const NO_STREAM = ["lift-me-up", "remember-who-you-are-mp3-1"];

  /** Every winner pickRandomPlayable can return for this filter, sweeping the random draw. */
  async function reachableWinners(opts: { current: string; landing: boolean; nativeInUse: boolean }) {
    const { pickRandomPlayable, hasStream, wheelWinnerFilter } = await import("./streams.ts");
    const { SOUNDCLOUD_TRACKS } = await import("./soundcloud-tracks.ts");
    const playable = wheelWinnerFilter<(typeof SOUNDCLOUD_TRACKS)[number]>({
      landing: opts.landing,
      nativeInUse: opts.nativeInUse,
      isNative: (t) => hasStream(t.slug),
    });
    const won = new Set<string>();
    const n = SOUNDCLOUD_TRACKS.length;
    for (let k = 0; k < n; k++) {
      const t = pickRandomPlayable(SOUNDCLOUD_TRACKS, { except: opts.current, playable, random: () => (k + 0.5) / n });
      if (t) won.add(t.id);
    }
    return { won, all: SOUNDCLOUD_TRACKS.map((t) => t.id) };
  }

  it("the two tablets without a stream are still the only ones (else the filter is moot)", async () => {
    const { hasStream } = await import("./streams.ts");
    const { SOUNDCLOUD_TRACKS } = await import("./soundcloud-tracks.ts");
    assert.deepEqual(SOUNDCLOUD_TRACKS.filter((t) => !hasStream(t.slug)).map((t) => t.id).sort(), NO_STREAM);
  });

  it("only the automatic landing with native in use is filtered", async () => {
    const { wheelWinnerFilter } = await import("./streams.ts");
    const isNative = (x: string) => x !== "sc-only";
    assert.equal(wheelWinnerFilter({ landing: false, nativeInUse: true, isNative }), undefined);
    assert.equal(wheelWinnerFilter({ landing: false, nativeInUse: false, isNative }), undefined);
    assert.equal(wheelWinnerFilter({ landing: true, nativeInUse: false, isNative }), undefined);
    assert.equal(wheelWinnerFilter({ landing: true, nativeInUse: true, isNative }), isNative);
  });

  it("a normal spin with native in use can land on every tablet, including lift-me-up and remember-who-you-are-mp3-1", async () => {
    const { won, all } = await reachableWinners({ current: "the-sleepers-waking", landing: false, nativeInUse: true });
    assert.deepEqual([...won].sort(), all.filter((id) => id !== "the-sleepers-waking").sort());
    for (const id of NO_STREAM) assert.ok(won.has(id), id);
  });

  it("every tablet can win from any current tablet (only the current one is skipped)", async () => {
    const { SOUNDCLOUD_TRACKS } = await import("./soundcloud-tracks.ts");
    for (const current of [...NO_STREAM, SOUNDCLOUD_TRACKS[0].id, SOUNDCLOUD_TRACKS.at(-1)!.id]) {
      const { won, all } = await reachableWinners({ current, landing: false, nativeInUse: true });
      assert.equal(won.size, all.length - 1, current);
      assert.equal(won.has(current), false, current);
    }
  });

  it("the first-visit landing still never picks a SoundCloud-only tablet", async () => {
    const { won } = await reachableWinners({ current: "the-sleepers-waking", landing: true, nativeInUse: true });
    for (const id of NO_STREAM) assert.equal(won.has(id), false, id);
    assert.equal(won.size, SOUNDCLOUD_TRACKS.length - 1 - NO_STREAM.length);
    assert.equal(SOUNDCLOUD_TRACKS.length, 107);
  });

  it("wiring: spinTablet filters only for markEntered / landing; only the automatic spins pass them", async () => {
    const fs = await import("node:fs");
    const read = (p: string) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
    const store = read("./player-store.ts");
    const spin = store.slice(store.indexOf("  spinTablet: (opts) => {"), store.indexOf("useWheelSpin.getState().begin(winner.id"));
    assert.match(spin, /playable: wheelWinnerFilter<Track>\(\{\s*landing: Boolean\(opts\?\.markEntered \|\| opts\?\.landing\),\s*nativeInUse: nativeAllowed\(\),/);
    assert.doesNotMatch(spin, /playable: nativeAllowed\(\) \?/, "no unconditional native-only filter");
    // Enter's first-visit spin and the wheel's auto spin are the landings ...
    assert.match(store, /get\(\)\.spinTablet\(\{ force: true, markEntered: true \}\)/);
    const wheel = read("../components/song-wheel.tsx");
    assert.match(wheel, /if \(action === "spin"\) spinTablet\(\{ force: true, landing: true \}\)/);
    // ... every tap-driven spin is a normal one.
    const tapSpins = [
      ...wheel.matchAll(/spinTablet\(([^)]*)\)/g),
      ...read("../components/track-wall.tsx").matchAll(/spinTablet\(([^)]*)\)/g),
      ...read("../components/now-playing.tsx").matchAll(/spinTablet\(([^)]*)\)/g),
    ].map((m) => m[1]);
    const landings = tapSpins.filter((a) => /markEntered|landing/.test(a));
    assert.deepEqual(landings, ["{ force: true, landing: true }"]);
    assert.ok(tapSpins.filter((a) => a === "").length >= 3, "the wheel, wall dice and dock random spins pass no landing flag");
  });
});

describe("a tablet SoundCloud has not published yet (no sound id)", () => {
  const slug = STREAM_SLUGS[0];
  it("has no SoundCloud target, so a failed stream shows the error instead of falling back", () => {
    for (const soundId of ["", "  ", undefined, null]) {
      assert.equal(canUseSoundCloud({ soundId }), false, String(soundId));
      assert.equal(streamFailureAction({ soundId }), "error", String(soundId));
    }
    assert.equal(canUseSoundCloud({ soundId: "2414888580" }), true);
    assert.equal(streamFailureAction({ soundId: "2414888580" }), "sc");
  });
  it("stays native after its stream fails (Try again refetches), even with ?player=sc", () => {
    const failed = new Set([slug]);
    assert.equal(pickBackend({ slug, allowNative: true, failed, soundCloud: false }), "native");
    assert.equal(pickBackend({ slug, allowNative: false, soundCloud: false }), "native");
    // With a sound id a failed stream still falls back to SoundCloud.
    assert.equal(pickBackend({ slug, allowNative: true, failed, soundCloud: true }), "sc");
    assert.equal(pickBackend({ slug, allowNative: true, failed }), "sc");
  });
  it("every catalogue tablet without a sound id has a native stream", () => {
    const unpublished = SOUNDCLOUD_TRACKS.filter((t) => !canUseSoundCloud(t));
    for (const t of unpublished) assert.equal(hasStream(t.slug), true, t.id);
  });
  it("Don't Fear now has its SoundCloud sound, so a failed stream falls back to SoundCloud", () => {
    const t = SOUNDCLOUD_TRACKS.find((x) => x.id === "dont-fear")!;
    assert.equal(t.soundId, "2414925384");
    assert.equal(streamFailureAction(t), "sc");
    assert.equal(pickBackend({ slug: t.slug, allowNative: true, failed: new Set([t.slug]), soundCloud: canUseSoundCloud(t) }), "sc");
    assert.equal(pickBackend({ slug: t.slug, allowNative: true, soundCloud: canUseSoundCloud(t) }), "native");
  });
});
