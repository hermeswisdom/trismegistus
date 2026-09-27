import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  IDLE_ATTEMPT,
  PLAY_BLOCKED_COPY,
  PLAY_BLOCKED_POSITION_MS,
  PLAY_BLOCKED_SETTLE_MS,
  PLAY_PENDING_COPY,
  SC_USER_ID,
  planPlayback,
  playControlAria,
  playControlFace,
  playControlShowsPause,
  playlistCovers,
  reduceAttempt,
  resolvePlayTap,
  soundcloudPlayerSrc,
  soundcloudPlaylistSrc,
  type AttemptEvent,
  type AttemptState,
  type PlaybackSurface,
  SC_PLAY_BUTTON,
  mediaVolumeIgnored,
  pickTapTarget,
  tapOverlayPlacement,
  tapTargetNudge,
} from "./playback.ts";

const ready: PlaybackSurface = {
  hasWidget: true,
  widgetReady: true,
  liveSoundId: "999",
  soundIndex: -1,
  soundsComplete: true,
  audioUnlocked: false,
};

const playCmd = {
  intent: "play" as const,
  soundId: "111",
  permalink: "https://soundcloud.com/esoteric_vibrations/x",
};

describe("planPlayback (one widget, profile playlist)", () => {
  it("plays the cued sound with a plain play()", () => {
    assert.deepEqual(planPlayback(playCmd, { ...ready, liveSoundId: "111" }), { op: "play" });
  });

  it("skips to another sound in the playlist and plays in the same turn", () => {
    assert.deepEqual(planPlayback(playCmd, { ...ready, soundIndex: 7 }), {
      op: "skip-play",
      index: 7,
    });
  });

  it("never rewrites the iframe for a catalog sound", () => {
    const ops = [
      planPlayback(playCmd, { ...ready, soundIndex: 0 }),
      planPlayback(playCmd, { ...ready, liveSoundId: "111" }),
      planPlayback(playCmd, { ...ready, soundIndex: -1, soundsComplete: false }),
    ].map((plan) => plan.op);
    assert.equal(ops.includes("load"), false);
  });

  it("queues until the widget is ready", () => {
    assert.deepEqual(planPlayback(playCmd, { ...ready, widgetReady: false }), {
      op: "wait",
      prime: false,
    });
    assert.deepEqual(planPlayback(playCmd, { ...ready, hasWidget: false }), {
      op: "wait",
      prime: false,
    });
  });

  it("queues while the playlist loads and primes inside the tap if audio is still locked", () => {
    assert.deepEqual(planPlayback(playCmd, { ...ready, soundsComplete: false }), {
      op: "wait",
      prime: true,
    });
    assert.deepEqual(
      planPlayback(playCmd, { ...ready, soundsComplete: false, audioUnlocked: true }),
      { op: "wait", prime: false },
    );
  });

  it("falls back to a single-track load only for a sound missing from a complete playlist", () => {
    assert.deepEqual(planPlayback(playCmd, ready), { op: "load" });
  });

  it("pauses whenever a widget exists", () => {
    const pause = { ...playCmd, intent: "pause" as const };
    assert.deepEqual(planPlayback(pause, ready), { op: "pause" });
    assert.deepEqual(planPlayback(pause, { ...ready, hasWidget: false }), { op: "none" });
  });
});

describe("playlistCovers", () => {
  it("is complete only when every catalog id is present", () => {
    assert.equal(playlistCovers(["1", "2", "3"], ["1", "3"]), true);
    assert.equal(playlistCovers(["1", "2"], ["1", "3"]), false);
    assert.equal(playlistCovers([], ["1"]), false);
  });
});

function runAttempt(events: AttemptEvent[], start: AttemptState = IDLE_ATTEMPT) {
  let state = start;
  const notices: string[] = [];
  const effects: string[] = [];
  for (const event of events) {
    const result = reduceAttempt(state, event);
    state = result.state;
    if (result.notice) notices.push(result.notice);
    effects.push(...result.effects);
  }
  return { state, notices, effects };
}

describe("reduceAttempt (honest play state)", () => {
  const t0 = 1_000_000;

  it("stays pending on PLAY and confirms only on progress > 0", () => {
    const run = runAttempt([
      { type: "start", soundId: "111", now: t0 },
      { type: "widget-play", soundId: "111", now: t0 + 50 },
    ]);
    assert.deepEqual(run.notices, ["pending"]);
    assert.equal(run.state.phase, "pending");

    const zero = runAttempt(
      [{ type: "widget-progress", soundId: "111", position: 0 }],
      run.state,
    );
    assert.equal(zero.state.phase, "pending");

    const live = runAttempt(
      [{ type: "widget-progress", soundId: "111", position: 180 }],
      run.state,
    );
    assert.deepEqual(live.notices, ["play"]);
    assert.equal(live.state.phase, "playing");
  });

  it("treats a PAUSE at ~0 with no PLAY behind it as blocked", () => {
    const run = runAttempt([
      { type: "start", soundId: "111", now: t0 },
      { type: "widget-play", soundId: "111", now: t0 + 40 },
      { type: "widget-pause", soundId: "111", position: 0, now: t0 + 400 },
    ]);
    assert.deepEqual(run.effects.filter((e) => e === "arm-settle"), ["arm-settle"]);
    const settled = reduceAttempt(run.state, {
      type: "settle-timeout",
      now: t0 + 400 + PLAY_BLOCKED_SETTLE_MS,
    });
    assert.equal(settled.notice, "blocked");
    assert.equal(settled.state.phase, "blocked");
  });

  it("does not block on the PLAY/PAUSE/PLAY burst a normal skip produces", () => {
    const run = runAttempt([
      { type: "start", soundId: "111", now: t0 },
      { type: "widget-play", soundId: "111", now: t0 + 20 },
      { type: "widget-pause", soundId: "111", position: 0, now: t0 + 30 },
      { type: "widget-play", soundId: "111", now: t0 + 60 },
      { type: "settle-timeout", now: t0 + 30 + PLAY_BLOCKED_SETTLE_MS },
      { type: "widget-progress", soundId: "111", position: 190 },
    ]);
    assert.deepEqual(run.notices, ["pending", "play"]);
  });

  it("ignores events from the sound being skipped away from", () => {
    const playing: AttemptState = { phase: "playing", soundId: "old", startedAt: t0, suspectSince: null };
    const run = runAttempt(
      [
        { type: "start", soundId: "new", now: t0 + 10 },
        { type: "widget-pause", soundId: "old", position: 6111, now: t0 + 20 },
        { type: "widget-progress", soundId: "old", position: 6200 },
      ],
      playing,
    );
    assert.deepEqual(run.notices, ["pending"]);
    assert.equal(run.state.phase, "pending");
  });

  it("a PAUSE well past zero while pending is not a refusal", () => {
    const run = runAttempt([
      { type: "start", soundId: "111", now: t0 },
      { type: "widget-pause", soundId: "111", position: PLAY_BLOCKED_POSITION_MS + 500, now: t0 + 100 },
    ]);
    assert.equal(run.effects.includes("arm-settle"), false);
  });

  it("reports a real pause and finish only after confirmed playback", () => {
    const playing: AttemptState = { phase: "playing", soundId: "111", startedAt: t0, suspectSince: null };
    assert.equal(
      reduceAttempt(playing, { type: "widget-pause", soundId: "111", position: 5000, now: t0 }).notice,
      "pause",
    );
    assert.equal(reduceAttempt(playing, { type: "widget-finish", soundId: "111" }).notice, "finish");
    assert.equal(
      reduceAttempt(IDLE_ATTEMPT, { type: "widget-pause", soundId: "111", position: 0, now: t0 }).notice,
      null,
    );
  });

  it("blocks on a widget error or the confirm timeout while pending", () => {
    const pending = runAttempt([{ type: "start", soundId: "111", now: t0 }]).state;
    assert.equal(reduceAttempt(pending, { type: "widget-error" }).notice, "blocked");
    assert.equal(reduceAttempt(pending, { type: "confirm-timeout" }).notice, "blocked");
  });

  it("a late progress after blocked recovers to playing", () => {
    const blocked: AttemptState = { phase: "blocked", soundId: "111", startedAt: t0, suspectSince: null };
    assert.equal(
      reduceAttempt(blocked, { type: "widget-progress", soundId: "111", position: 400 }).notice,
      "play",
    );
  });

  it("stop (user pause) goes idle without a notice", () => {
    const pending = runAttempt([{ type: "start", soundId: "111", now: t0 }]).state;
    const stopped = reduceAttempt(pending, { type: "stop" });
    assert.equal(stopped.state.phase, "idle");
    assert.equal(stopped.notice, null);
  });
});

describe("embed urls", () => {
  it("hosts the whole esoteric_vibrations profile, never auto-playing", () => {
    const src = new URL(soundcloudPlaylistSrc());
    assert.equal(src.origin, "https://w.soundcloud.com");
    assert.equal(src.searchParams.get("url"), `https://api.soundcloud.com/users/${SC_USER_ID}`);
    assert.equal(src.searchParams.get("auto_play"), "false");
    assert.equal(src.searchParams.get("visual"), "false");
  });

  it("still builds single-track urls", () => {
    assert.match(soundcloudPlayerSrc("1", true), /tracks%2F1/);
  });
});

describe("copy", () => {
  it("asks for a tap when the browser refused to start", () => {
    assert.equal(PLAY_BLOCKED_COPY, "Tap to play");
    assert.match(PLAY_PENDING_COPY, /sounding/i);
  });
});

describe("resolvePlayTap", () => {
  const base = {
    currentId: "alpha",
    tapId: "alpha",
    playing: false,
    playPending: false,
    playError: null as string | null,
  };

  it("plays a different cover even if another tablet is pending", () => {
    assert.equal(
      resolvePlayTap({ ...base, playing: true, playPending: true, tapId: "beta" }),
      "play",
    );
  });

  it("retries the same cover when play is pending or blocked", () => {
    assert.equal(
      resolvePlayTap({ ...base, playing: true, playPending: true }),
      "play",
    );
    assert.equal(
      resolvePlayTap({ ...base, playing: false, playError: PLAY_BLOCKED_COPY }),
      "play",
    );
  });

  it("pauses only a confirmed playing tablet", () => {
    assert.equal(resolvePlayTap({ ...base, playing: true }), "pause");
    assert.equal(resolvePlayTap(base), "play");
  });
});

describe("playControlFace", () => {
  const rest = { playing: false, playPending: false, playError: null as string | null };

  it("pending is its own face; Pause only once confirmed playing", () => {
    assert.equal(playControlFace({ ...rest, playPending: true }), "pending");
    assert.equal(playControlFace({ ...rest, playPending: true, playing: true }), "pending");
    assert.equal(playControlShowsPause(playControlFace({ ...rest, playPending: true, playing: true })), true);
    assert.equal(playControlAria(playControlFace({ ...rest, playPending: true, playing: true })), "Pause");
    assert.equal(playControlFace({ ...rest, playing: true }), "pause");
  });

  it("keeps retry copy when the tablet did not sound", () => {
    assert.equal(playControlFace({ ...rest, playError: PLAY_BLOCKED_COPY }), "retry");
    assert.equal(playControlAria(playControlFace({ ...rest, playError: PLAY_BLOCKED_COPY })), "Retry play");
    assert.equal(playControlFace(rest), "play");
  });
});

describe("mediaVolumeIgnored", () => {
  const base = { platform: "", maxTouchPoints: 0, coarsePointer: false, volumeSticks: true };
  it("flags iPhone / iPad / iPod", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    assert.equal(mediaVolumeIgnored({ ...base, userAgent: ua, maxTouchPoints: 5 }), true);
  });
  it("flags iPadOS posing as a Mac", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
    assert.equal(mediaVolumeIgnored({ ...base, userAgent: ua, platform: "MacIntel", maxTouchPoints: 5 }), true);
    assert.equal(mediaVolumeIgnored({ ...base, userAgent: ua, platform: "MacIntel" }), false);
  });
  it("flags any browser whose volume does not stick", () => {
    assert.equal(mediaVolumeIgnored({ ...base, userAgent: "X11; Linux", volumeSticks: false }), true);
  });
  it("leaves desktop Chrome and Android alone", () => {
    assert.equal(mediaVolumeIgnored({ ...base, userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/140" }), false);
    assert.equal(
      mediaVolumeIgnored({ ...base, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/140 Mobile", maxTouchPoints: 5, coarsePointer: true }),
      false,
    );
  });
});

describe("tap overlay", () => {
  it("centres SoundCloud's play button on the control", () => {
    const spot = tapOverlayPlacement({ left: 1164, top: 814, width: 44, height: 44 });
    assert.equal(spot.left + SC_PLAY_BUTTON.x, 1186);
    assert.equal(spot.top + SC_PLAY_BUTTON.y, 836);
    assert.match(spot.clipPath, /^circle\(20px at 29px 32px\)$/);
  });
  it("keeps the clip inside a small control", () => {
    assert.match(tapOverlayPlacement({ left: 0, top: 0, width: 30, height: 30 }).clipPath, /circle\(15px/);
  });
  const vp = { width: 1440, height: 900, dockTop: 780 };
  const dock = { kind: "dock" as const, rect: { left: 1164, top: 814, width: 44, height: 44 } };
  const wheel = { kind: "wheel" as const, rect: { left: 600, top: 500, width: 160, height: 44 } };
  it("prefers the wheel's Tap to play when fully on screen", () => {
    assert.equal(pickTapTarget([dock, wheel], vp)?.kind, "wheel");
  });
  it("falls back to the dock when the wheel button is off screen or under the dock", () => {
    assert.equal(pickTapTarget([dock, { ...wheel, rect: { ...wheel.rect, top: -60 } }], vp)?.kind, "dock");
    assert.equal(pickTapTarget([dock, { ...wheel, rect: { ...wheel.rect, top: 760 } }], vp)?.kind, "dock");
  });
  it("follows the control under the pointer", () => {
    assert.equal(pickTapTarget([dock, wheel], vp, "dock")?.kind, "dock");
  });
  it("returns null with nothing visible", () => {
    assert.equal(pickTapTarget([], vp), null);
  });
});

describe("tapTargetNudge", () => {
  const vp = { height: 664, dockTop: 542 };
  it("leaves a clear button alone", () => {
    assert.equal(tapTargetNudge({ left: 20, top: 300, width: 146, height: 44 }, vp), 0);
  });
  it("lifts a button stuck behind the dock", () => {
    assert.equal(tapTargetNudge({ left: 20, top: 605, width: 146, height: 44 }, vp), 605 + 44 - (542 - 16));
    assert.equal(tapTargetNudge({ left: 20, top: 505, width: 146, height: 44 }, vp), 505 + 44 - 526);
  });
  it("lowers a button just above the top", () => {
    assert.equal(tapTargetNudge({ left: 20, top: -30, width: 146, height: 44 }, vp), -46);
  });
  it("ignores a button far away", () => {
    assert.equal(tapTargetNudge({ left: 20, top: 3000, width: 146, height: 44 }, vp), 0);
    assert.equal(tapTargetNudge({ left: 20, top: -2000, width: 146, height: 44 }, vp), 0);
  });
});
