import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createVisibleGate, mayPostWhileHidden } from "./visible-gate.ts";
import { nextHeartbeatDelay } from "./visitor-count.ts";

function fakeDoc(hidden = false) {
  const listeners = new Set<() => void>();
  return {
    hidden,
    addEventListener: (_: "visibilitychange", fn: () => void) => listeners.add(fn),
    removeEventListener: (_: "visibilitychange", fn: () => void) => listeners.delete(fn),
    show() {
      this.hidden = false;
      for (const fn of [...listeners]) fn();
    },
    hide() {
      this.hidden = true;
      for (const fn of [...listeners]) fn();
    },
    listeners,
  };
}

describe("visible gate", () => {
  it("runs a job at once while the tab is visible", () => {
    const doc = fakeDoc(false);
    const gate = createVisibleGate(doc);
    let runs = 0;
    gate.run("k", () => runs++);
    assert.equal(runs, 1);
    assert.deepEqual(gate.pending(), []);
    assert.equal(doc.listeners.size, 0);
  });

  it("holds jobs while hidden and runs them once visible again", () => {
    const doc = fakeDoc(true);
    const gate = createVisibleGate(doc);
    const ran: string[] = [];
    gate.run("last-tablet", () => ran.push("save"));
    gate.run("favorites-merge", () => ran.push("merge"));
    assert.deepEqual(ran, []);
    doc.hide(); // still hidden: nothing
    assert.deepEqual(ran, []);
    doc.show();
    assert.deepEqual(ran.sort(), ["merge", "save"]);
    assert.deepEqual(gate.pending(), []);
    assert.equal(doc.listeners.size, 0);
    doc.hide();
    doc.show();
    assert.equal(ran.length, 2, "a flushed job never runs twice");
  });

  it("keeps only the latest job per key (five auto-advances → one save)", () => {
    const doc = fakeDoc(true);
    const gate = createVisibleGate(doc);
    const saved: string[] = [];
    for (const id of ["a", "b", "c", "d", "e"]) gate.run("last-tablet", () => saved.push(id));
    doc.show();
    assert.deepEqual(saved, ["e"]);
  });

  it("drops a cancelled job, and a failing job does not block the rest", () => {
    const doc = fakeDoc(true);
    const gate = createVisibleGate(doc);
    const ran: string[] = [];
    gate.run("x", () => ran.push("x"));
    gate.cancel("x");
    gate.run("boom", () => {
      throw new Error("boom");
    });
    gate.run("ok", () => ran.push("ok"));
    doc.show();
    assert.deepEqual(ran, ["ok"]);
  });

  it("lets only a play record leave a hidden tab", () => {
    assert.equal(mayPostWhileHidden("play"), true);
    assert.equal(mayPostWhileHidden("deferred"), false);
  });

  it("schedules no heartbeat while hidden", () => {
    assert.equal(nextHeartbeatDelay({ hidden: true, lastPingAt: null, now: 0 }), null);
    assert.equal(nextHeartbeatDelay({ hidden: true, lastPingAt: 0, now: 10 * 60_000, resumed: true }), null);
  });
});

// Every POST server function must be classified, so a new one cannot quietly
// start posting from background tabs.
const POLICY: Record<string, "play" | "heartbeat" | "deferred" | "tap" | "preview"> = {
  recordPlay: "play", // allowed while hidden: auto-advance / lock-screen next is a real listen
  visitorHeartbeat: "heartbeat", // own visible-only timer (heartbeat-client.ts)
  saveMyLastTablet: "deferred",
  syncMyFavorites: "deferred",
  listTrackMarks: "deferred",
  setMyFavorite: "tap",
  addTrackMark: "tap",
  addSignal: "tap",
  startMasterCheckout: "tap",
  redeemMasterPurchase: "tap", // /download loader after the Stripe redirect
  getConnectorReadiness: "preview", // Grok preview iframe only
};

const SRC = new URL("../", import.meta.url).pathname;
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : [];
  });
}
const files = walk(SRC).map((p) => ({ p: path.relative(SRC, p), text: fs.readFileSync(p, "utf8") }));

describe("hidden-tab POST policy", () => {
  it("classifies every POST server function", () => {
    const posts = files.flatMap((f) =>
      [...f.text.matchAll(/export const (\w+) = createServerFn\(\{ method: "POST" \}\)/g)].map((m) => m[1]),
    );
    assert.ok(posts.length >= 10, `found ${posts.length}`);
    for (const name of posts) assert.ok(POLICY[name], `unclassified POST server fn: ${name} (add it to POLICY)`);
  });

  it("calls deferred POSTs only through whenVisible", () => {
    for (const [name, kind] of Object.entries(POLICY)) {
      if (kind !== "deferred") continue;
      const callers = files.filter((f) => new RegExp(`\\b${name}\\(`).test(f.text) && !f.text.includes(`export const ${name} =`));
      assert.ok(callers.length > 0, `${name} has no caller`);
      for (const f of callers) {
        for (const m of f.text.matchAll(new RegExp(`\\b${name}\\(`, "g"))) {
          const before = f.text.slice(0, m.index);
          const gate = before.lastIndexOf("whenVisible(");
          assert.ok(gate >= 0 && m.index! - gate < 600, `${f.p}: ${name}() is not inside whenVisible(...)`);
        }
      }
    }
  });

  it("the heartbeat checks document.hidden before posting", () => {
    const hb = files.find((f) => f.p === "lib/heartbeat-client.ts")!.text;
    assert.match(hb, /if \(inFlight \|\| document\.hidden\) return;/);
    assert.match(hb, /nextHeartbeatDelay\(\{ hidden: document\.hidden/);
  });
});
