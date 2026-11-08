import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shouldActivateWaitingWorker, shouldRegisterOfflineWorker } from "./offline-runtime.ts";

const ROOT = join(import.meta.dirname, "..", "..");

describe("offline worker registration", () => {
  it("registers only in production browsers that have serviceWorker", () => {
    assert.equal(shouldRegisterOfflineWorker({ prod: false, window: { navigator: { serviceWorker: {} } } }), false);
    assert.equal(shouldRegisterOfflineWorker({ prod: true, window: undefined }), false);
    assert.equal(shouldRegisterOfflineWorker({ prod: true, window: { navigator: {} } }), false);
    assert.equal(shouldRegisterOfflineWorker({ prod: true, window: { navigator: { serviceWorker: {} } } }), true);
  });

  it("does not skipWaiting a waiting worker while audio is pending or playing", () => {
    assert.equal(shouldActivateWaitingWorker("playing"), false);
    assert.equal(shouldActivateWaitingWorker("pending"), false);
    assert.equal(shouldActivateWaitingWorker("idle"), true);
    assert.equal(shouldActivateWaitingWorker("blocked"), true);
  });

  it("the page runtime never reloads on controllerchange", () => {
    const src = readFileSync(join(ROOT, "src/lib/offline-runtime.ts"), "utf8");
    assert.doesNotMatch(src, /location\.reload/);
    const root = readFileSync(join(ROOT, "src/routes/__root.tsx"), "utf8");
    assert.match(root, /<OfflineRuntime/);
  });
});
