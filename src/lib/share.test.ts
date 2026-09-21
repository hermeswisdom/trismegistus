import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clipboardShareText,
  homeOgCopy,
  tabletSharePayload,
} from "./share.ts";
import { SITE_ORIGIN } from "./tablet-link.ts";

const TRACK = { title: "Fragile God", slug: "fragile-god" };

describe("tabletSharePayload", () => {
  it("shares the wall URL, not SoundCloud, under Atman Music", () => {
    const payload = tabletSharePayload(TRACK, {
      origin: SITE_ORIGIN,
      meaning: "They come in robes.\nSecond line.",
    });
    assert.equal(payload.title, "Fragile God — Atman Music");
    assert.equal(payload.url, `${SITE_ORIGIN}/?tablet=fragile-god`);
    assert.match(payload.text, /Fragile God on Atman Music/);
    assert.match(payload.text, /They come in robes/);
    assert.equal(payload.text.includes("Esoteric Vibrations"), false);
    assert.equal(payload.url.includes("soundcloud.com"), false);
  });

  it("falls back to the live Production alias when origin is omitted", () => {
    const payload = tabletSharePayload(TRACK);
    assert.equal(payload.url, `${SITE_ORIGIN}/?tablet=fragile-god`);
    assert.equal(payload.url.includes("trismegistus-three"), false);
  });

  it("names today's tablet in the share", () => {
    const payload = tabletSharePayload(TRACK, {
      daily: true,
      origin: "https://example.test",
    });
    assert.equal(
      payload.title,
      "Today's tablet — Fragile God — Atman Music",
    );
    assert.equal(payload.url, "https://example.test/?daily=1");
    assert.match(payload.text, /Today's tablet on Atman Music: Fragile God/);
  });
});

describe("clipboardShareText", () => {
  it("puts the title above the URL so a paste still unfurls", () => {
    assert.equal(
      clipboardShareText({
        title: "Fragile God — Atman Music",
        text: "Play it",
        url: "https://example.test/?tablet=fragile-god",
      }),
      "Fragile God — Atman Music\nhttps://example.test/?tablet=fragile-god",
    );
  });
});

describe("homeOgCopy", () => {
  it("keeps the unmarked home as Atman Music", () => {
    const copy = homeOgCopy({
      source: "none",
      title: "Fragile God",
      meaning: "A long verse.",
    });
    assert.equal(copy.title, "Atman Music");
    assert.equal(copy.description.includes("Esoteric Vibrations"), false);
  });

  it("uses the tablet title on a deep link", () => {
    const copy = homeOgCopy({
      source: "tablet",
      title: "Fragile God",
      meaning: "They come in robes and ring lights.",
    });
    assert.equal(copy.title, "Fragile God — Atman Music");
    assert.match(copy.description, /They come in robes/);
  });
});
