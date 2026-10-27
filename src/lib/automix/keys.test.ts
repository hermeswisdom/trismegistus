import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoMixHandlesEscape, autoMixPanelHasFocus } from "./keys.ts";

describe("Auto Mix Escape", () => {
  it("handles Escape when the panel is expanded or focused, not for a background mini dock", () => {
    assert.equal(autoMixHandlesEscape({ expanded: true, panelHasFocus: false }), true);
    assert.equal(autoMixHandlesEscape({ expanded: false, panelHasFocus: true }), true);
    assert.equal(autoMixHandlesEscape({ expanded: true, panelHasFocus: true }), true);
    assert.equal(autoMixHandlesEscape({ expanded: false, panelHasFocus: false }), false);
  });

  it("treats a keydown target or active element inside the panel as focus", () => {
    const inside = {} as EventTarget;
    const outside = {} as EventTarget;
    const panel = { contains(node: Node) { return node === (inside as unknown as Node); } };
    assert.equal(autoMixPanelHasFocus(panel, { target: inside }, outside), true);
    assert.equal(autoMixPanelHasFocus(panel, { target: outside }, inside), true);
    assert.equal(autoMixPanelHasFocus(panel, { target: outside }, outside), false);
    assert.equal(autoMixPanelHasFocus(null, { target: inside }, inside), false);
  });
});
