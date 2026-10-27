import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { STREAM_SLUGS } from "../stream-manifest.ts";
import { type MixTrack, type Mood } from "./types.ts";
import {
  autoMixEngineState,
  hushAutoMix,
  pauseAutoMix,
  remixAutoMix,
  resetAutoMixForTests,
  resumeAutoMix,
  startAutoMix,
  subscribeAutoMix,
  type AutoMixNotice,
} from "./engine.ts";

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
  volume = 1;
  plays: { src: string; muted: boolean }[] = [];
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  set src(v: string) {
    this.attrs.set("src", v);
  }
  get src() {
    return this.attrs.get("src") ?? "";
  }
  play() {
    this.plays.push({ src: this.src, muted: this.muted });
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  remove() {}
  fire(type: string) {
    this.dispatchEvent(new Event(type));
  }
}

class FakeGain {
  gain = {
    value: 0,
    sets: [] as number[],
    curves: [] as Float32Array[],
    cancelScheduledValues() {},
    setValueAtTime(v: number) {
      this.value = v;
      this.sets.push(v);
    },
    setValueCurveAtTime(curve: Float32Array) {
      this.curves.push(curve);
      this.value = curve[curve.length - 1] ?? this.value;
    },
  };
  connect() {}
  disconnect() {}
}

let gains: FakeGain[] = [];

class FakeAudioContext {
  currentTime = 0;
  state = "running";
  destination = {};
  createGain() {
    const g = new FakeGain();
    gains.push(g);
    return g;
  }
  createMediaElementSource() {
    return { connect() {}, disconnect() {} };
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
}

function track(slug: string, extra?: Partial<MixTrack> & { mood?: Mood }): MixTrack {
  return {
    slug,
    title: slug,
    bpm: 120,
    camelot: "8A",
    energy: 0.5,
    duration: 180,
    outroStart: 150,
    outroBars: 16,
    mood: "hype",
    secondaryMood: null,
    ...extra,
  };
}

const A = STREAM_SLUGS[0]!;
const B = STREAM_SLUGS[1]!;
const C = STREAM_SLUGS[2]!;
const D = STREAM_SLUGS[3]!;

let audios: FakeAudio[] = [];
let notices: AutoMixNotice[] = [];
let unsub: (() => void) | null = null;

function installDom(search = "") {
  audios = [];
  gains = [];
  const document = {
    createElement: (tag: string) => {
      if (tag !== "audio") return { setAttribute() {}, style: {} };
      const a = new FakeAudio();
      audios.push(a);
      return a;
    },
    body: { appendChild() {} },
  };
  Object.assign(globalThis, {
    window: {
      AudioContext: FakeAudioContext,
      location: { search },
    },
    document,
    AudioContext: FakeAudioContext,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  });
}

beforeEach(() => {
  resetAutoMixForTests();
  installDom();
  notices = [];
  unsub = subscribeAutoMix((n) => notices.push(n));
});

afterEach(() => {
  unsub?.();
  unsub = null;
  resetAutoMixForTests();
});

const types = () => notices.map((n) => n.type);

describe("Auto Mix engine", () => {
  it("loads the HQ stream URL and plays the first deck at unity gain", () => {
    assert.equal(startAutoMix([track(A, { energy: 0.12 }), track(B, { energy: 0.9 })]), true);
    assert.equal(audios[0]!.src, `/api/stream/${A}?hq=1`);
    assert.equal(audios[1]!.src, `/api/stream/${B}?hq=1`);
    assert.doesNotMatch(audios[0]!.src, /masters/);
    // gains[0] is master (value 1); deck 0 then deck 1.
    assert.ok(gains[1]!.gain.sets.includes(1));
    assert.equal(gains[1]!.gain.sets.at(-1), 1);
    assert.ok(gains[2]!.gain.sets.includes(0));
    assert.equal(gains[0]!.gain.value, 1);
  });

  it("keeps ?via=direct on the HQ request so CORS A/B still works", () => {
    resetAutoMixForTests();
    installDom("?stream=direct");
    assert.equal(startAutoMix([track(A)]), true);
    assert.equal(audios[0]!.src, `/api/stream/${A}?hq=1&via=direct`);
  });

  it("claims playing on the resumed deck once it is actually playing", () => {
    assert.equal(startAutoMix([track(A), track(B)]), true);
    assert.deepEqual(types(), ["pending"]);
    audios[0]!.fire("playing");
    assert.deepEqual(types(), ["pending", "play"]);
    pauseAutoMix();
    assert.equal(types().at(-1), "pause");
    assert.equal(autoMixEngineState().pending, false);
    resumeAutoMix();
    assert.equal(types().at(-1), "pending");
    assert.equal(autoMixEngineState().pending, true);
    assert.equal(autoMixEngineState().playing, true);
    audios[0]!.fire("playing");
    assert.equal(types().at(-1), "play");
    assert.equal(autoMixEngineState().pending, false);
    const lastPlay = notices.filter((n): n is Extract<AutoMixNotice, { type: "play" }> => n.type === "play").at(-1);
    assert.equal(lastPlay?.slug, A);
  });

  it("skip-fades into a remixed queue without dropping the current track", () => {
    startAutoMix([track(A), track(B)]);
    audios[0]!.fire("playing");
    assert.equal(remixAutoMix([track(C), track(D)]), true);
    assert.equal(autoMixEngineState().current?.slug, A);
    assert.equal(autoMixEngineState().next?.slug, C);
    assert.equal(audios[1]!.src, `/api/stream/${C}?hq=1`);
    assert.ok(audios[1]!.plays.some((p) => p.src === `/api/stream/${C}?hq=1`));
  });

  it("marks a yielded hush so the wall can close the panel", () => {
    startAutoMix([track(A)]);
    hushAutoMix({ yieldPanel: true });
    const stop = notices.find((n) => n.type === "stop");
    assert.equal(stop?.type === "stop" && stop.yieldPanel, true);
  });
});
