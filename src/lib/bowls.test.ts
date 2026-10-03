import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BOWLS,
  BOWLS_DISCLAIMER,
  BOWLS_PATH,
  BOWL_KINDS,
  BOWL_TIMERS,
  bowlMetaLine,
  bowlsByKind,
  endsAtFromTimer,
  getBowl,
  remainingSeconds,
} from "./bowls.ts";

const src = (p: string) =>
  fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("healing sound bowls", () => {
  it("ships 15–20 unique sittings", () => {
    assert.ok(
      BOWLS.length >= 15 && BOWLS.length <= 20,
      `${BOWLS.length} bowls`,
    );
    const ids = BOWLS.map((b) => b.id);
    const names = BOWLS.map((b) => b.name);
    const hz = BOWLS.map((b) => b.hz);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(names).size, names.length);
    assert.equal(new Set(hz).size, hz.length);
  });

  it("covers solfeggio, chakras, 432, Schumann, sleep and focus", () => {
    const hz = new Set(BOWLS.map((b) => b.hz));
    for (const n of [174, 285, 396, 417, 528, 639, 741, 852, 963, 432, 7.83]) {
      assert.ok(hz.has(n), `missing ${n}`);
    }
    assert.ok(BOWLS.some((b) => b.id === "deep-sleep-25"));
    assert.ok(BOWLS.some((b) => b.id === "focus-40"));
    assert.equal(BOWLS.filter((b) => b.kind === "chakra").length >= 4, true);
  });

  it("gives every bowl a frequency, use, and how-to-listen", () => {
    for (const bowl of BOWLS) {
      assert.ok(bowl.hz > 0, bowl.id);
      assert.match(bowl.hzLabel, /Hz/);
      assert.ok(bowl.use.length > 40, bowl.id);
      assert.ok(bowl.listen.length > 20, bowl.id);
      assert.ok(bowl.carrierHz > 0, bowl.id);
      if (bowl.voice === "binaural") {
        assert.ok(bowl.beatHz && bowl.beatHz > 0, bowl.id);
        assert.match(bowl.listen, /headphone/i);
      }
    }
  });

  it("hedges claimed uses and ships the medical disclaimer", () => {
    assert.match(BOWLS_DISCLAIMER, /not medical advice/i);
    for (const bowl of BOWLS) {
      assert.match(
        bowl.use,
        /traditionally|many people|claimed|often described|some teachers/i,
        bowl.id,
      );
      assert.doesNotMatch(
        bowl.use,
        /\b(cures|cured|treats|treated|heals|healed|diagnoses|diagnosed)\b/i,
      );
    }
    const ui = [
      src("components/healing-sounds.tsx"),
      src("routes/bowls.tsx"),
      src("lib/bowls.ts"),
    ].join("\n");
    assert.match(ui, /not medical advice/);
  });

  it("looks up bowls and filters by family", () => {
    assert.equal(getBowl("miracle-528")?.hz, 528);
    assert.equal(getBowl("missing"), undefined);
    assert.equal(bowlsByKind("all").length, BOWLS.length);
    assert.ok(bowlsByKind("solfeggio").every((b) => b.kind === "solfeggio"));
    assert.match(bowlMetaLine(getBowl("root-128")!), /128 Hz · C3 · Root/);
    assert.match(bowlMetaLine(getBowl("schumann-783")!), /binaural/);
  });

  it("has 5 / 10 / 20 / 30 minute timers plus loop", () => {
    assert.deepEqual(
      BOWL_TIMERS.map((t) => t.minutes),
      [5, 10, 20, 30, 0],
    );
    assert.equal(endsAtFromTimer(0, 1_000), null);
    assert.equal(endsAtFromTimer(10, 0), 600_000);
    assert.equal(remainingSeconds(null, 0), null);
    assert.equal(remainingSeconds(10_000, 9_200), 1);
    assert.equal(remainingSeconds(10_000, 12_000), 0);
  });

  it("is wired into the wall, the header, and its own page", () => {
    assert.equal(BOWLS_PATH, "/bowls");
    assert.ok(BOWL_KINDS.some((k) => k.id === "all"));
    const header = src("components/site-header.tsx");
    const home = src("routes/index.tsx");
    const footer = src("components/site-footer.tsx");
    assert.match(header, /#bowls/);
    assert.match(home, /HealingSounds/);
    assert.match(footer, /\/bowls/);
    assert.match(src("routes/bowls.tsx"), /createFileRoute\("\/bowls"\)/);
  });
});
