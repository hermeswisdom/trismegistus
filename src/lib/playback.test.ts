import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLAY_BLOCKED_COPY,
  embedNeedsRewrite,
  planPlayback,
  soundcloudPlayerSrc,
} from "./playback.ts";

const surface = {
  widgetReady: false,
  hasWidget: false,
  hasIframe: false,
  liveSoundId: null as string | null,
  unlocked: false,
};

const playCmd = {
  intent: "play" as const,
  soundId: "111",
  permalink: "https://soundcloud.com/esoteric_vibrations/x",
};

describe("planPlayback", () => {
  it("plays the live sound through a ready widget", () => {
    const plan = planPlayback(playCmd, {
      ...surface,
      hasWidget: true,
      widgetReady: true,
      liveSoundId: "111",
    });
    assert.equal(plan.widgetOp, "play");
    assert.equal(plan.iframeSoundId, null);
    assert.equal(plan.expectPlayEvent, true);
  });

  it("loads a new sound with autoplay when the widget is ready", () => {
    const plan = planPlayback(playCmd, {
      ...surface,
      hasWidget: true,
      widgetReady: true,
      liveSoundId: "222",
    });
    assert.equal(plan.widgetOp, "load");
    assert.equal(plan.loadAutoplay, true);
    assert.equal(plan.iframeSoundId, null);
  });

  it("rewrites the iframe src in the same turn when the widget is not ready", () => {
    const plan = planPlayback(playCmd, {
      ...surface,
      hasIframe: true,
      hasWidget: true,
      widgetReady: false,
    });
    assert.equal(plan.widgetOp, null);
    assert.equal(plan.iframeSoundId, "111");
    assert.equal(plan.iframeAutoplay, true);
    assert.equal(plan.expectPlayEvent, true);
  });

  it("force-embeds on retry so a failed mobile play can start from a new gesture", () => {
    const plan = planPlayback(
      { ...playCmd, forceEmbed: true },
      {
        ...surface,
        hasIframe: true,
        hasWidget: true,
        widgetReady: true,
        liveSoundId: "111",
      },
    );
    assert.equal(plan.iframeSoundId, "111");
    assert.equal(plan.iframeAutoplay, true);
    assert.equal(plan.widgetOp, "play");
  });

  it("pauses the widget without touching the iframe", () => {
    const plan = planPlayback(
      { ...playCmd, intent: "pause" },
      { ...surface, hasWidget: true, widgetReady: true, liveSoundId: "111" },
    );
    assert.equal(plan.widgetOp, "pause");
    assert.equal(plan.expectPlayEvent, false);
    assert.equal(plan.iframeSoundId, null);
  });
});

describe("embedNeedsRewrite", () => {
  it("treats equivalent query orders as the same embed", () => {
    const a = soundcloudPlayerSrc("1", true);
    const b = soundcloudPlayerSrc("1", true);
    assert.equal(embedNeedsRewrite(a, b), false);
    assert.equal(embedNeedsRewrite(a, soundcloudPlayerSrc("1", false)), true);
  });
});

describe("copy", () => {
  it("keeps the blocked-play rite in brand voice", () => {
    assert.match(PLAY_BLOCKED_COPY, /tablet did not sound/i);
  });
});
