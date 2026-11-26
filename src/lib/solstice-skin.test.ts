import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SOLSTICE_SKIN,
  SOLSTICE_SKIN_BOOT,
  applySolsticeSkin,
  civilMinutes,
  isInRecurringWindow,
  isInSolsticeWindow,
  isSolsticeSkinActive,
  parseSkinOverride,
  parseSkinQueryValue,
} from "./solstice-skin.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("SOLSTICE_SKIN config", () => {
  it("gates 1 Dec 00:00 through 6 Jan 23:59 Europe/London", () => {
    assert.equal(SOLSTICE_SKIN.timezone, "Europe/London");
    assert.equal(SOLSTICE_SKIN.id, "solstice");
    assert.equal(SOLSTICE_SKIN.queryParam, "skin");
    assert.deepEqual(SOLSTICE_SKIN.start, {
      month: 12,
      day: 1,
      hour: 0,
      minute: 0,
    });
    assert.deepEqual(SOLSTICE_SKIN.end, {
      month: 1,
      day: 6,
      hour: 23,
      minute: 59,
    });
  });
});

describe("isInSolsticeWindow", () => {
  it("opens at 1 Dec 00:00 London and closes after 6 Jan 23:59 London", () => {
    // Dec–Jan is GMT (UTC+0).
    assert.equal(
      isInSolsticeWindow(new Date("2026-11-30T23:59:00.000Z")),
      false,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2026-12-01T00:00:00.000Z")),
      true,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2026-12-21T12:00:00.000Z")),
      true,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2026-12-31T23:30:00.000Z")),
      true,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2027-01-01T00:00:00.000Z")),
      true,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2027-01-06T23:59:00.000Z")),
      true,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2027-01-07T00:00:00.000Z")),
      false,
    );
  });

  it("repeats every year and stays off in midsummer", () => {
    assert.equal(
      isInSolsticeWindow(new Date("2025-12-15T12:00:00.000Z")),
      true,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2028-01-03T12:00:00.000Z")),
      true,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2026-06-21T12:00:00.000Z")),
      false,
    );
    assert.equal(
      isInSolsticeWindow(new Date("2026-11-01T12:00:00.000Z")),
      false,
    );
  });
});

describe("isInRecurringWindow", () => {
  it("wraps the new year when start is after end", () => {
    const start = { month: 12, day: 1, hour: 0, minute: 0 };
    const end = { month: 1, day: 6, hour: 23, minute: 59 };
    assert.equal(civilMinutes(start) > civilMinutes(end), true);
    assert.equal(
      isInRecurringWindow(
        { month: 12, day: 1, hour: 0, minute: 0 },
        start,
        end,
      ),
      true,
    );
    assert.equal(
      isInRecurringWindow(
        { month: 1, day: 6, hour: 23, minute: 59 },
        start,
        end,
      ),
      true,
    );
    assert.equal(
      isInRecurringWindow({ month: 1, day: 7, hour: 0, minute: 0 }, start, end),
      false,
    );
    assert.equal(
      isInRecurringWindow(
        { month: 11, day: 30, hour: 23, minute: 59 },
        start,
        end,
      ),
      false,
    );
  });

  it("stays a same-year interval when start is before end", () => {
    const start = { month: 6, day: 1, hour: 0, minute: 0 };
    const end = { month: 6, day: 21, hour: 12, minute: 0 };
    assert.equal(
      isInRecurringWindow(
        { month: 6, day: 10, hour: 0, minute: 0 },
        start,
        end,
      ),
      true,
    );
    assert.equal(
      isInRecurringWindow(
        { month: 12, day: 25, hour: 0, minute: 0 },
        start,
        end,
      ),
      false,
    );
  });
});

describe("QC override ?skin=", () => {
  it("reads solstice / off from URLs, queries and search objects", () => {
    assert.equal(parseSkinQueryValue("?skin=solstice"), "solstice");
    assert.equal(
      parseSkinQueryValue("/?tablet=djinn&skin=solstice"),
      "solstice",
    );
    assert.equal(
      parseSkinQueryValue("https://atmanmusic.app/?skin=off"),
      "off",
    );
    assert.equal(
      parseSkinQueryValue(new URLSearchParams("skin=solstice")),
      "solstice",
    );
    assert.equal(parseSkinQueryValue({ skin: "off" }), "off");
    assert.equal(parseSkinQueryValue({ skin: "nope" }), undefined);
    assert.equal(parseSkinQueryValue("?qc=1"), undefined);
    assert.equal(parseSkinQueryValue(null), undefined);
  });

  it("forces the skin on or off regardless of the calendar", () => {
    const june = new Date("2026-06-21T12:00:00.000Z");
    const december = new Date("2026-12-21T12:00:00.000Z");
    assert.equal(
      isSolsticeSkinActive({ now: june, search: "?skin=solstice" }),
      true,
    );
    assert.equal(
      isSolsticeSkinActive({ now: december, search: "?skin=off" }),
      false,
    );
    assert.equal(
      isSolsticeSkinActive({ now: june, search: "?skin=nope" }),
      false,
    );
    assert.equal(isSolsticeSkinActive({ now: december }), true);
    assert.equal(parseSkinOverride("?skin=solstice"), "on");
    assert.equal(parseSkinOverride("?skin=off"), "off");
    assert.equal(parseSkinOverride("?skin=winter"), null);
  });
});

describe("applySolsticeSkin", () => {
  it("sets data-skin and theme-color only while the skin is on", () => {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (name: string, value: string) =>
        void attrs.set(name, value),
      removeAttribute: (name: string) => void attrs.delete(name),
    };
    const metaAttrs = new Map<string, string>([
      ["content", SOLSTICE_SKIN.restThemeColor],
    ]);
    const themeMeta = {
      setAttribute: (name: string, value: string) =>
        void metaAttrs.set(name, value),
    };

    assert.equal(
      applySolsticeSkin(root, {
        now: new Date("2026-06-21T12:00:00.000Z"),
        search: "?skin=solstice",
        themeMeta,
      }),
      true,
    );
    assert.equal(attrs.get("data-skin"), "solstice");
    assert.equal(metaAttrs.get("content"), SOLSTICE_SKIN.themeColor);

    assert.equal(
      applySolsticeSkin(root, {
        now: new Date("2026-12-21T12:00:00.000Z"),
        search: "?skin=off",
        themeMeta,
      }),
      false,
    );
    assert.equal(attrs.has("data-skin"), false);
    assert.equal(metaAttrs.get("content"), SOLSTICE_SKIN.restThemeColor);
  });
});

describe("SOLSTICE_SKIN_BOOT", () => {
  it("inlines the window so first paint does not wait for React", () => {
    assert.match(SOLSTICE_SKIN_BOOT, /Europe\/London/);
    assert.match(SOLSTICE_SKIN_BOOT, /data-skin/);
    assert.match(SOLSTICE_SKIN_BOOT, /solstice/);
    assert.match(
      SOLSTICE_SKIN_BOOT,
      new RegExp(String(civilMinutes(SOLSTICE_SKIN.start))),
    );
    assert.match(
      SOLSTICE_SKIN_BOOT,
      new RegExp(String(civilMinutes(SOLSTICE_SKIN.end))),
    );
    assert.doesNotMatch(SOLSTICE_SKIN_BOOT, /requestAnimationFrame|canvas/i);
  });

  it("is valid JS and does not throw without a document", () => {
    assert.doesNotThrow(() => new Function(SOLSTICE_SKIN_BOOT));
  });
});

describe("solstice skin wiring", () => {
  it("root boots the skin before body paint and re-applies after hydrate", () => {
    const root = read("src/routes/__root.tsx");
    const component = read("src/components/solstice-skin.tsx");
    const lib = read("src/lib/solstice-skin.ts");
    assert.match(root, /SOLSTICE_SKIN_BOOT/);
    assert.match(root, /<SolsticeSkin/);
    assert.match(component, /useLayoutEffect/);
    assert.match(component, /applySolsticeSkin/);
    assert.match(component, /return null/);
    assert.match(lib, /React #418/);
    assert.doesNotMatch(root, /data-skin=\{/);
  });

  it("CSS is gated on html[data-skin=solstice] and respects reduced motion", () => {
    const css = read("src/styles.css");
    assert.match(css, /html\[data-skin="solstice"\]/);
    assert.match(css, /@keyframes solstice-drift/);
    assert.match(css, /--solstice-gold/);
    const reduce = css.split("@media (prefers-reduced-motion: reduce)");
    assert.match(reduce.at(-1)!, /data-skin="solstice"/);
    assert.match(reduce.at(-1)!, /animation:\s*none/);
  });

  it("does not touch stream, master, stripe or env paths", () => {
    const lib = read("src/lib/solstice-skin.ts");
    assert.doesNotMatch(lib, /BLOB_|STRIPE_|DATABASE_|masters\//);
    assert.doesNotMatch(
      read("src/routes/api/stream/$slug.ts"),
      /solstice-skin/,
    );
    assert.doesNotMatch(
      read("src/routes/api/stripe/webhook.ts"),
      /solstice-skin/,
    );
    assert.doesNotMatch(
      read("src/routes/api/masters/download.ts"),
      /solstice-skin/,
    );
  });
});
