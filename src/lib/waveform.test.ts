import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadWaveform, resetWaveformForTests } from "./waveform.ts";

describe("loadWaveform", () => {
  beforeEach(() => {
    resetWaveformForTests();
  });

  it("does not refetch a 403 wave so the widget is not hammered", async () => {
    let hits = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      hits += 1;
      return { ok: false, status: 403 } as Response;
    }) as typeof fetch;
    try {
      await loadWaveform("2403987975", "https://wave.example/w.png");
      await loadWaveform("2403987975", "https://wave.example/w.png");
      assert.equal(hits, 1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
