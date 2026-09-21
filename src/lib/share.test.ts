import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clipboardShareText,
  homeOgCard,
  homeOgCopy,
  shareTabletAsDaily,
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

  it("falls back to atmanmusic.app when origin is omitted", () => {
    const payload = tabletSharePayload(TRACK);
    assert.equal(payload.url, `${SITE_ORIGIN}/?tablet=fragile-god`);
    assert.equal(payload.url, "https://atmanmusic.app/?tablet=fragile-god");
    assert.equal(payload.url.includes("trismegistus-three"), false);
    assert.equal(payload.url.includes("vercel.app"), false);
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

describe("shareTabletAsDaily", () => {
  it("is true only for today's tablet", () => {
    assert.equal(shareTabletAsDaily("fragile-god", "fragile-god"), true);
    assert.equal(shareTabletAsDaily("fragile-god", "the-sleepers-waking"), false);
    assert.equal(shareTabletAsDaily("", "fragile-god"), false);
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

describe("homeOgCard", () => {
  const track = {
    title: "Fragile God",
    meaning: "They come in robes and ring lights.",
    image: "/images/tracks/fragile-god.jpg",
    slug: "fragile-god",
  };

  it("uses the brand card, site name, and atmanmusic.app url on unmarked home", () => {
    const card = homeOgCard({ source: "none", ...track });
    assert.equal(card.title, "Atman Music");
    assert.equal(card.siteName, "Atman Music");
    assert.equal(card.url, "https://atmanmusic.app/");
    assert.equal(card.image, "https://atmanmusic.app/og.jpg");
    assert.equal(card.imageAlt, "Atman Music");
    assert.equal(card.url.includes("atmanmusic.com"), false);
  });

  it("uses catalog cover art on a tablet deep link", () => {
    const card = homeOgCard({ source: "tablet", ...track });
    assert.equal(card.title, "Fragile God — Atman Music");
    assert.equal(card.siteName, "Atman Music");
    assert.equal(card.url, "https://atmanmusic.app/?tablet=fragile-god");
    assert.equal(
      card.image,
      "https://atmanmusic.app/images/tracks/fragile-god.jpg",
    );
    assert.equal(card.image, `${SITE_ORIGIN}/images/tracks/fragile-god.jpg`);
    assert.equal(card.image.includes("/og.jpg"), false);
  });

  it("uses catalog cover art on today's tablet", () => {
    const card = homeOgCard({ source: "daily", ...track });
    assert.equal(card.title, "Today's tablet — Fragile God — Atman Music");
    assert.equal(card.siteName, "Atman Music");
    assert.equal(card.url, "https://atmanmusic.app/?daily=1");
    assert.equal(
      card.image,
      "https://atmanmusic.app/images/tracks/fragile-god.jpg",
    );
  });
});
