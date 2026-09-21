import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyPlayback,
  bindLiveWidget,
  getPlaybackSurface,
  noteUserGesture,
  resetPlaybackForTests,
  setLiveIframe,
  subscribePlayback,
  type SCWidget,
} from "./sc-widget.ts";

const Events = {
  READY: "ready",
  PLAY: "play",
  PAUSE: "pause",
  FINISH: "finish",
  PLAY_PROGRESS: "playProgress",
};

function fakeWidget() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const plays: string[] = [];
  const loads: { url: string; auto?: boolean }[] = [];
  const widget: SCWidget & { fire: (ev: string) => void } = {
    bind(event, listener) {
      listeners.set(event, listener);
    },
    unbind(event) {
      listeners.delete(event);
    },
    play() {
      plays.push("play");
    },
    pause() {},
    toggle() {},
    load(url, options) {
      loads.push({ url, auto: options?.auto_play });
    },
    seekTo() {},
    getPosition(cb) {
      cb(0);
    },
    getDuration(cb) {
      cb(0);
    },
    getVolume(cb) {
      cb(0);
    },
    setVolume() {},
    getCurrentSound(cb) {
      cb(null);
    },
    fire(ev) {
      listeners.get(ev)?.();
    },
  };
  return { widget, plays, loads };
}

function fakeIframe(src = "") {
  const el = {
    src,
    getAttribute(name: string) {
      return name === "src" ? el.src : null;
    },
    setAttribute(name: string, value: string) {
      if (name === "src") el.src = value;
    },
  };
  return el as unknown as HTMLIFrameElement;
}

const cmd = {
  intent: "play" as const,
  soundId: "555",
  permalink: "https://soundcloud.com/esoteric_vibrations/tablet",
};

describe("sc-widget playback client", () => {
  beforeEach(() => {
    resetPlaybackForTests();
  });

  it("does not play on noteUserGesture", () => {
    const { widget, plays } = fakeWidget();
    bindLiveWidget(widget, Events, "555");
    widget.fire("ready");
    noteUserGesture();
    assert.equal(plays.length, 0);
    assert.equal(getPlaybackSurface().unlocked, true);
  });

  it("calls widget.play in the same turn when ready", () => {
    const { widget, plays } = fakeWidget();
    bindLiveWidget(widget, Events, "555");
    widget.fire("ready");
    applyPlayback(cmd);
    assert.deepEqual(plays, ["play"]);
  });

  it("rewrites iframe src when the widget is not ready", () => {
    const iframe = fakeIframe("https://w.soundcloud.com/player/?auto_play=false");
    setLiveIframe(iframe);
    applyPlayback(cmd);
    assert.match(iframe.src, /auto_play=true/);
    assert.match(iframe.src, /555/);
  });

  it("loads a different permalink once the widget is ready", () => {
    const { widget, loads } = fakeWidget();
    bindLiveWidget(widget, Events, "111");
    widget.fire("ready");
    applyPlayback(cmd);
    assert.equal(loads.length, 1);
    assert.equal(loads[0]?.url, cmd.permalink);
    assert.equal(loads[0]?.auto, true);
  });

  it("keeps a pending sound id when the widget rebinds", () => {
    const { widget } = fakeWidget();
    applyPlayback(cmd);
    bindLiveWidget(widget, Events, "featured-old");
    assert.equal(getPlaybackSurface().liveSoundId, "555");
  });

  it("ignores a widget pause while a play is still pending", () => {
    const types: string[] = [];
    const off = subscribePlayback((notice) => types.push(notice.type));
    const { widget } = fakeWidget();
    bindLiveWidget(widget, Events, "555");
    widget.fire("ready");
    applyPlayback(cmd);
    widget.fire("pause");
    off();
    assert.equal(types.includes("pause"), false);
    assert.equal(types.includes("pending"), true);
  });
});
