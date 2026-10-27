import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import { moodForSlug } from "./og-mood.ts";
import {
  MOOD_PALETTES,
  OG_IMAGE_SIZE,
  OG_MOODS,
  OG_PATH,
  mixPageUrl,
  ogCardUrl,
  parseOgSearch,
  publicOrigin,
  shareMetaTags,
  shareTabletPath,
  shareTabletUrl,
  titleFontSize,
} from "./og-card.ts";

const analysis = JSON.parse(
  readFileSync(new URL("../data/track-analysis.json", import.meta.url), "utf8"),
) as Record<string, { mood?: string }>;

describe("parseOgSearch", () => {
  it("defaults, track slug, and reserved mix hook", () => {
    assert.deepEqual(parseOgSearch(""), { kind: "default" });
    assert.deepEqual(parseOgSearch("slug=fragile-god"), {
      kind: "track",
      slug: "fragile-god",
    });
    assert.deepEqual(parseOgSearch("mix=abc"), { kind: "mix", mix: "abc" });
    assert.deepEqual(parseOgSearch("slug=fragile-god&mix=abc"), {
      kind: "mix",
      mix: "abc",
      slug: "fragile-god",
    });
  });
});

describe("ogCardUrl", () => {
  it("builds absolute https URLs for default, track and mix cards", () => {
    assert.equal(ogCardUrl(), "https://atmanmusic.app/api/og");
    assert.equal(OG_PATH, "/api/og");
    assert.equal(
      ogCardUrl({ slug: "fragile-god" }),
      "https://atmanmusic.app/api/og?slug=fragile-god",
    );
    assert.equal(
      ogCardUrl({ mix: "abc", origin: "https://example.test" }),
      "https://example.test/api/og?mix=abc",
    );
  });
});

describe("shareTabletUrl", () => {
  it("is a path, not a query string, so crawlers without JS still see the meta", () => {
    assert.equal(shareTabletPath("fragile-god"), "/t/fragile-god");
    assert.equal(shareTabletUrl("fragile-god"), "https://atmanmusic.app/t/fragile-god");
    assert.equal(mixPageUrl("abc"), "https://atmanmusic.app/?mix=abc");
  });
});

describe("shareMetaTags", () => {
  it("emits og + twitter tags at 1200×630 with an absolute image URL", () => {
    const tags = shareMetaTags({
      title: "Fragile God — Atman Music",
      description: "They come in robes.",
      url: "https://atmanmusic.app/t/fragile-god",
      image: "https://atmanmusic.app/api/og?slug=fragile-god",
      imageAlt: "Fragile God — Atman Music",
      siteName: "Atman Music",
    });
    const byKey = Object.fromEntries(
      tags.map((tag) => [("property" in tag ? tag.property : tag.name), tag.content]),
    );
    assert.equal(byKey["og:image"], "https://atmanmusic.app/api/og?slug=fragile-god");
    assert.equal(byKey["og:image:width"], "1200");
    assert.equal(byKey["og:image:height"], "630");
    assert.equal(byKey["og:type"], "website");
    assert.equal(byKey["twitter:card"], "summary_large_image");
    assert.equal(byKey["twitter:image"], byKey["og:image"]);
    assert.equal(OG_IMAGE_SIZE.width, 1200);
    assert.equal(OG_IMAGE_SIZE.height, 630);
  });
});

describe("mood palettes", () => {
  it("has a distinct accent for chill, hype, dark, happy, dreamy and epic", () => {
    const accents = OG_MOODS.map((mood) => MOOD_PALETTES[mood].accent);
    assert.equal(new Set(accents).size, OG_MOODS.length);
    assert.equal(MOOD_PALETTES.chill.bg.startsWith("#"), true);
  });

  it("analysis moods are known palettes; missing rows fall back to chill", () => {
    let known = 0;
    for (const track of SOUNDCLOUD_TRACKS) {
      const recorded = analysis[track.slug]?.mood ?? analysis[track.id]?.mood;
      const mood = moodForSlug(track.slug);
      assert.equal(OG_MOODS.includes(mood), true, `${track.slug} mood ${mood}`);
      if (recorded) {
        assert.equal(mood, recorded, track.slug);
        known += 1;
      } else {
        assert.equal(mood, "chill", track.slug);
      }
    }
    assert.ok(known > 50, `expected most of the catalogue to be analysed, got ${known}`);
  });
});

describe("titleFontSize", () => {
  it("shrinks long titles so they fit the card", () => {
    assert.equal(titleFontSize("Djinn"), 64);
    assert.ok(titleFontSize("Mine's Just on a Folding Chair") < 64);
  });
});

describe("publicOrigin", () => {
  it("stays on atmanmusic.app in production and follows the request otherwise", () => {
    const prevEnv = process.env.VERCEL_ENV;
    const prevUrl = process.env.VERCEL_URL;
    try {
      process.env.VERCEL_ENV = "production";
      delete process.env.VERCEL_URL;
      assert.equal(publicOrigin("https://trismegistus-xxx.vercel.app/"), "https://atmanmusic.app");
      process.env.VERCEL_ENV = "preview";
      process.env.VERCEL_URL = "trismegistus-xxx.vercel.app";
      assert.equal(publicOrigin(), "https://trismegistus-xxx.vercel.app");
    } finally {
      if (prevEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevEnv;
      if (prevUrl === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevUrl;
    }
  });
});
