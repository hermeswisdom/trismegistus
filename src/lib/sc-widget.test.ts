import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyPlayback,
  bindLiveWidget,
  getAttemptPhase,
  getPlaybackSurface,
  isAudioUnlocked,
  isPriming,
  noteUserGesture,
  primeForLaterPlay,
  resetPlaybackForTests,
  setCatalogSoundIds,
  setLiveIframe,
  setPlaylistForTests,
  subscribePlayback,
  type SCWidget,
} from "./sc-widget.ts";

const Events = {
  READY: "ready",
  PLAY: "play",
  PAUSE: "pause",
  FINISH: "finish",
  PLAY_PROGRESS: "playProgress",
  ERROR: "error",
};

function fakeWidget(cued = "900") {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const calls: string[] = [];
  const widget: SCWidget & { fire: (ev: string, raw?: unknown) => void } = {
    bind(event, listener) {
      listeners.set(event, listener);
    },
    unbind(event) {
      listeners.delete(event);
    },
    play() {
      calls.push("play");
    },
    pause() {
      calls.push("pause");
    },
    toggle() {},
    load(url, options) {
      calls.push(`load:${url}:${options?.auto_play}`);
    },
    skip(index) {
      calls.push(`skip:${index}`);
    },
    getSounds(cb) {
      cb([]);
    },
    seekTo(ms) {
      calls.push(`seek:${ms}`);
    },
    getPosition(cb) {
      cb(0);
    },
    getDuration(cb) {
      cb(0);
    },
    getVolume(cb) {
      cb(100);
    },
    setVolume(v) {
      calls.push(`vol:${v}`);
    },
    getCurrentSound(cb) {
      cb({ id: Number(cued) });
    },
    fire(ev, raw) {
      listeners.get(ev)?.(raw);
    },
  };
  return { widget, calls };
}

const PLAYLIST = ["900", "555", "777"];
const cmd = {
  intent: "play" as const,
  soundId: "555",
  permalink: "https://soundcloud.com/esoteric_vibrations/tablet",
};

function readyWidget(cued = "900") {
  const fake = fakeWidget(cued);
  bindLiveWidget(fake.widget, Events);
  fake.widget.fire("ready");
  setPlaylistForTests(PLAYLIST, true);
  fake.calls.length = 0;
  return fake;
}

function collect() {
  const types: string[] = [];
  subscribePlayback((notice) => types.push(notice.type));
  return types;
}

describe("sc-widget: one widget, one tap", () => {
  beforeEach(() => {
    resetPlaybackForTests();
  });

  it("does not play on noteUserGesture", () => {
    const { calls } = readyWidget();
    noteUserGesture();
    assert.deepEqual(calls, []);
  });

  it("learns the cued sound from the widget, not the caller", () => {
    readyWidget("777");
    assert.equal(getPlaybackSurface().liveSoundId, "777");
  });

  it("skips + plays a different tablet synchronously, with no iframe rewrite", () => {
    const iframe = { src: "https://w.soundcloud.com/player/?url=users" } as HTMLIFrameElement;
    setLiveIframe(iframe);
    const { calls } = readyWidget();
    applyPlayback(cmd);
    assert.deepEqual(calls, ["skip:1", "play"]);
    assert.equal(iframe.src, "https://w.soundcloud.com/player/?url=users");
    assert.equal(calls.some((c) => c.startsWith("load")), false);
  });

  it("retry on the cued tablet is a plain play() in the same turn", () => {
    const { calls } = readyWidget("555");
    applyPlayback(cmd);
    assert.deepEqual(calls, ["play"]);
  });

  it("stays pending on PLAY and confirms on the first progress > 0", () => {
    const { widget } = readyWidget();
    const types = collect();
    applyPlayback(cmd);
    widget.fire("play", { soundId: 555, currentPosition: 0 });
    assert.deepEqual(types, ["pending"]);
    widget.fire("playProgress", { soundId: 555, currentPosition: 0 });
    assert.deepEqual(types, ["pending"]);
    widget.fire("playProgress", { soundId: 555, currentPosition: 150 });
    assert.deepEqual(types.slice(0, 2), ["pending", "play"]);
    assert.equal(getAttemptPhase(), "playing");
    assert.equal(isAudioUnlocked(), true);
  });

  it("a refused start (PAUSE at 0, no PLAY behind it) becomes blocked", async () => {
    const { widget } = readyWidget();
    const types = collect();
    applyPlayback(cmd);
    widget.fire("play", { soundId: 555, currentPosition: 0 });
    widget.fire("pause", { soundId: 555, currentPosition: 0 });
    assert.equal(types.includes("pause"), false);
    await new Promise((resolve) => setTimeout(resolve, 750));
    assert.equal(types.includes("blocked"), true);
    assert.equal(getAttemptPhase(), "blocked");
    resetPlaybackForTests();
  });

  it("does not report the old tablet's pause while switching", () => {
    const { widget } = readyWidget("900");
    const types = collect();
    applyPlayback({ ...cmd, soundId: "900" });
    widget.fire("playProgress", { soundId: 900, currentPosition: 300 });
    applyPlayback(cmd);
    widget.fire("pause", { soundId: 900, currentPosition: 6100 });
    assert.equal(types.includes("pause"), false);
    resetPlaybackForTests();
  });

  it("treats a widget ERROR during a pending play as blocked", () => {
    const { widget } = readyWidget();
    const types = collect();
    applyPlayback(cmd);
    widget.fire("error");
    assert.equal(types.includes("blocked"), true);
  });

  it("queues a play while the playlist loads, primes in the tap, then skips when it arrives", () => {
    const fake = fakeWidget("900");
    bindLiveWidget(fake.widget, Events);
    fake.widget.fire("ready");
    setCatalogSoundIds(["900", "555", "777"]);
    setPlaylistForTests(["900"], false);
    fake.calls.length = 0;
    applyPlayback(cmd);
    assert.deepEqual(fake.calls, ["vol:0", "play"]);
    assert.equal(isPriming(), true);
    setPlaylistForTests(PLAYLIST);
    assert.deepEqual(fake.calls.slice(2), ["vol:100", "skip:1", "play"]);
    assert.equal(isPriming(), false);
    resetPlaybackForTests();
  });

  it("queues until READY and then plays", () => {
    const fake = fakeWidget("555");
    bindLiveWidget(fake.widget, Events);
    applyPlayback(cmd);
    assert.deepEqual(fake.calls, []);
    fake.widget.fire("ready");
    assert.deepEqual(fake.calls, ["play"]);
  });

  it("primes the wheel winner silently and pauses once audio flows", () => {
    const { widget, calls } = readyWidget();
    const types = collect();
    assert.equal(primeForLaterPlay("777"), true);
    assert.deepEqual(calls, ["vol:0", "skip:2", "play"]);
    widget.fire("play", { soundId: 777, currentPosition: 0 });
    widget.fire("playProgress", { soundId: 777, currentPosition: 120 });
    assert.deepEqual(calls.slice(3), ["pause", "seek:0", "vol:100"]);
    assert.deepEqual(types, []);
    assert.equal(isAudioUnlocked(), true);
    // Landing: same sound is cued, so a plain play().
    calls.length = 0;
    applyPlayback({ ...cmd, soundId: "777" });
    assert.deepEqual(calls, ["play"]);
    // Once unlocked, priming is a no-op.
    assert.equal(primeForLaterPlay("555"), false);
  });

  it("landing during a prime restores volume and restarts from zero", () => {
    const { calls } = readyWidget();
    primeForLaterPlay("777");
    calls.length = 0;
    applyPlayback({ ...cmd, soundId: "777" });
    assert.deepEqual(calls, ["vol:100", "play", "seek:0"]);
    resetPlaybackForTests();
  });

  it("pause stops the attempt and pauses the widget", () => {
    const { calls } = readyWidget();
    applyPlayback(cmd);
    calls.length = 0;
    applyPlayback({ ...cmd, intent: "pause" });
    assert.deepEqual(calls, ["pause"]);
    assert.equal(getAttemptPhase(), "idle");
  });

  it("falls back to a single-track load only when the sound is not in the playlist", () => {
    const { calls } = readyWidget();
    applyPlayback({ ...cmd, soundId: "404" });
    assert.deepEqual(calls, [`load:${cmd.permalink}:true`]);
    resetPlaybackForTests();
  });
});
