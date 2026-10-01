import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  failedStreams,
  isNativeUnlocked,
  nativePause,
  nativePhase,
  nativePlay,
  nativePrime,
  resetNativeForTests,
  subscribeNative,
  type NativeNotice,
} from "./native-audio.ts";
import { STREAM_SLUGS } from "./stream-manifest.ts";

const A = { id: STREAM_SLUGS[0], slug: STREAM_SLUGS[0] };
const B = { id: STREAM_SLUGS[1], slug: STREAM_SLUGS[1] };

class FakeAudio extends EventTarget {
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  preload = "";
  muted = false;
  paused = true;
  ended = false;
  currentTime = 0;
  duration = 200;
  plays: { src: string; muted: boolean }[] = [];
  nextPlay: (() => Promise<void>) | null = null;
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  set src(v: string) {
    this.attrs.set("src", v);
  }
  get src() {
    return this.attrs.get("src") ?? "";
  }
  play() {
    this.plays.push({ src: this.src, muted: this.muted });
    const next = this.nextPlay;
    this.nextPlay = null;
    if (next) return next();
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  fire(type: string) {
    this.dispatchEvent(new Event(type));
  }
}

let audio: FakeAudio;
let notices: NativeNotice[];

beforeEach(() => {
  resetNativeForTests();
  audio = new FakeAudio();
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => audio,
    body: { appendChild: () => undefined },
  };
  notices = [];
  subscribeNative((n) => notices.push(n));
});

afterEach(() => {
  nativePause();
  resetNativeForTests();
});

const types = () => notices.map((n) => n.type);
const tick = () => new Promise((r) => setImmediate(r));

describe("native player", () => {
  it("starts in the caller's turn: src + play() before returning, then pending", () => {
    assert.equal(nativePlay(A), true);
    assert.deepEqual(audio.plays, [{ src: `/api/stream/${A.slug}`, muted: false }]);
    assert.deepEqual(types(), ["pending"]);
    assert.equal(nativePhase(), "pending");
  });

  it("only claims playing once audio flows, then reports progress", () => {
    nativePlay(A);
    audio.currentTime = 0;
    audio.fire("timeupdate");
    assert.deepEqual(types(), ["pending"]);
    audio.fire("playing");
    audio.currentTime = 1.5;
    audio.fire("timeupdate");
    assert.deepEqual(types(), ["pending", "play", "progress"]);
    assert.equal(isNativeUnlocked(), true);
    const p = notices.at(-1) as Extract<NativeNotice, { type: "progress" }>;
    assert.equal(p.elapsed, 1.5);
    assert.equal(p.duration, 200);
  });

  it("a refused play() shows Tap to play (blocked)", async () => {
    audio.nextPlay = () => Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    nativePlay(A);
    await tick();
    assert.deepEqual(types(), ["pending", "blocked"]);
    assert.equal(nativePhase(), "blocked");
  });

  it("an AbortError (we changed src) is ignored", async () => {
    audio.nextPlay = () => Promise.reject(Object.assign(new Error("x"), { name: "AbortError" }));
    nativePlay(A);
    await tick();
    assert.deepEqual(types(), ["pending"]);
  });

  it("an unplayable stream falls back to SoundCloud for that tablet", async () => {
    audio.nextPlay = () => Promise.reject(Object.assign(new Error("x"), { name: "NotSupportedError" }));
    nativePlay(A);
    await tick();
    assert.deepEqual(types(), ["pending", "fallback"]);
    assert.equal(failedStreams().has(A.slug), true);
  });

  it("on ended, the next tablet's src + play() run inside the event (lock screen auto-advance)", () => {
    nativePlay(A);
    audio.fire("playing");
    let playsInsideEnded = -1;
    subscribeNative((n) => {
      if (n.type === "finish") {
        nativePlay(B);
        playsInsideEnded = audio.plays.length;
      }
    });
    audio.ended = true;
    audio.fire("ended");
    assert.equal(playsInsideEnded, 2);
    assert.equal(audio.plays[1].src, `/api/stream/${B.slug}`);
    assert.deepEqual(types(), ["pending", "play", "finish", "pending"]);
  });

  it("a pause of real playback (lock screen / headphones) is reported; a src change while pending is not", () => {
    nativePlay(A);
    audio.fire("pause");
    assert.deepEqual(types(), ["pending"]);
    audio.fire("playing");
    audio.fire("pause");
    assert.deepEqual(types(), ["pending", "play", "pause"]);
  });

  it("our own pause goes idle without a notice", () => {
    nativePlay(A);
    audio.fire("playing");
    nativePause();
    audio.fire("pause");
    assert.equal(nativePhase(), "idle");
    assert.deepEqual(types(), ["pending", "play"]);
  });

  it("a muted in-tap prime is silent in the UI, and the landing play restarts it unmuted from 0", () => {
    assert.equal(nativePrime(B), true);
    assert.equal(audio.plays[0].muted, true);
    audio.fire("playing");
    audio.currentTime = 3.2;
    audio.fire("timeupdate");
    assert.deepEqual(types(), []);
    assert.equal(isNativeUnlocked(), true);
    nativePlay(B);
    assert.equal(audio.currentTime, 0);
    assert.equal(audio.muted, false);
    assert.equal(audio.plays.length, 2);
    assert.deepEqual(types(), ["pending"]);
    // Once unlocked, no more primes.
    assert.equal(nativePrime(A), false);
  });

  it("a load error reloads a fresh signed URL once, then falls back", async () => {
    nativePlay(A);
    audio.fire("playing");
    audio.currentTime = 42;
    audio.fire("error");
    assert.match(audio.src, new RegExp(`^/api/stream/${A.slug}\\?r=\\d+$`));
    audio.fire("error");
    await tick();
    assert.equal(types().at(-1), "fallback");
  });
});
