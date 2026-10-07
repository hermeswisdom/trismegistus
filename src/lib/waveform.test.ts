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

describe("captured SoundCloud waveforms", () => {
  it("cover every catalogue sound id (no gaps, no orphans)", async () => {
    const { SOUNDCLOUD_TRACKS } = await import("./soundcloud-tracks.ts");
    const { WAVEFORM_URLS } = await import("./waveform-urls.ts");
    const ids = SOUNDCLOUD_TRACKS.map((t) => t.soundId).filter(Boolean);
    assert.deepEqual(ids.filter((id) => !WAVEFORM_URLS[id]), [], "catalogue sounds without a waveform");
    assert.deepEqual(Object.keys(WAVEFORM_URLS).filter((id) => !ids.includes(id)), [], "waveforms for no catalogue sound");
    for (const url of Object.values(WAVEFORM_URLS)) assert.match(url, /^https:\/\/wave\.sndcdn\.com\/[A-Za-z0-9]+_m\.json$/);
    assert.equal(WAVEFORM_URLS["2414888580"], "https://wave.sndcdn.com/PHV31tKnhjg9_m.json");
  });
});
