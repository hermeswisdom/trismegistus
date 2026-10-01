import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { audioDebugParam, classifyPause, OWN_PAUSE_WINDOW_MS } from "./audio-debug.ts";

describe("audio debug toggle", () => {
  it("?debug=audio turns it on, ?debug=off turns it off, anything else keeps the stored choice", () => {
    assert.equal(audioDebugParam("?debug=audio"), "on");
    assert.equal(audioDebugParam("?qc=1&debug=AUDIO"), "on");
    assert.equal(audioDebugParam("?debug=off"), "off");
    assert.equal(audioDebugParam("?debug=0"), "off");
    assert.equal(audioDebugParam("?debug=other"), null);
    assert.equal(audioDebugParam(""), null);
    assert.equal(audioDebugParam(null), null);
  });
});

describe("pause attribution", () => {
  const call = { at: 1000, reason: "wheel spin", stack: "spinTablet" };
  it("a pause right after our pause() is ours, with its reason", () => {
    assert.deepEqual(classifyPause({ now: 1200, call, visibility: "visible", ended: false }), {
      ours: true,
      reason: "wheel spin",
      stack: "spinTablet",
    });
  });
  it("a pause nobody asked for is the browser / OS (noting a hidden page)", () => {
    const late = 1000 + OWN_PAUSE_WINDOW_MS + 1;
    assert.equal(classifyPause({ now: late, call, visibility: "hidden", ended: false }).ours, false);
    assert.match(classifyPause({ now: late, call, visibility: "hidden", ended: false }).reason, /while the page was hidden/);
    assert.equal(classifyPause({ now: 5, call: null, visibility: "visible", ended: false }).ours, false);
  });
  it("the pause that comes with a track ending is just that", () => {
    assert.equal(classifyPause({ now: 1100, call, visibility: "hidden", ended: true }).reason, "track ended");
  });
});
