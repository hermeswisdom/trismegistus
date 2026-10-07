import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { escapeHtml } from "@tanstack/router-core";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import { MEANINGS } from "./meanings.ts";
import { DEFAULT_MASTER_PRICE_PENCE, trackIsForSale } from "./masters.ts";
import { londonDateKey, pickDailyTablet, resolveFocusedTablet } from "./daily-tablet.ts";
import { parseHomeSearch } from "./tablet-link.ts";
import { homeOgCard, homeOgUrl } from "./share.ts";
import {
  ARTIST_ID,
  ARTIST_SAME_AS,
  EBOOK_CANONICAL,
  HOME_URL,
  bookJsonLd,
  ebookJsonLd,
  homeCanonical,
  homeDescription,
  homeJsonLd,
  jsonLdGraph,
  jsonLdMeta,
  pageBreadcrumbJsonLd,
  pageCanonical,
  recordedIsoMonth,
  siteVerificationMeta,
  tabletJsonLd,
  type JsonLdNode,
} from "./seo.ts";

const read = (p: string) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ids = SOUNDCLOUD_TRACKS.map((t) => t.id);
const resolveId = (v: string) => SOUNDCLOUD_TRACKS.find((t) => t.id === v || t.slug === v)?.id;

/** What the home route does: parse the query, resolve the focus, canonicalise. */
function canonicalForQuery(query: string, dateKey = "2026-10-07"): string {
  const raw = Object.fromEntries(new URLSearchParams(query));
  const search = parseHomeSearch(raw);
  const focus = resolveFocusedTablet({
    daily: Boolean(search.daily),
    tablet: search.tablet,
    ids,
    dateKey,
    resolveId,
  });
  const track = SOUNDCLOUD_TRACKS.find((t) => t.id === focus.trackId)!;
  return homeCanonical({ source: focus.source, slug: track.slug });
}

function tabletGraph(track: (typeof SOUNDCLOUD_TRACKS)[number]): JsonLdNode[] {
  return tabletJsonLd({
    track,
    meaning: MEANINGS[track.id],
    pricePence: trackIsForSale(track) ? DEFAULT_MASTER_PRICE_PENCE : undefined,
  });
}

/** Round-trip through the exact escaping TanStack applies inside <script>. */
function renderAndParse(nodes: JsonLdNode[]): { "@context": string; "@graph": JsonLdNode[] } {
  const meta = jsonLdMeta(nodes) as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(meta), ["script:ld+json"]);
  assert.deepEqual(meta["script:ld+json"], jsonLdGraph(nodes));
  const html = escapeHtml(JSON.stringify(meta["script:ld+json"]));
  assert.doesNotMatch(html, /<\/?script/i);
  return JSON.parse(html);
}

const URL_KEYS = new Set(["url", "item", "image", "sameAs", "@id"]);

/** Structural JSON-LD checks: types, no empty values, absolute URLs. */
function assertValidNode(node: unknown, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => assertValidNode(v, `${path}[${i}]`));
    return;
  }
  if (node === null || node === undefined) assert.fail(`${path} is ${node}`);
  if (typeof node === "string") {
    assert.ok(node.trim().length > 0, `${path} is empty`);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  assert.ok(keys.includes("@type") || (keys.length === 1 && keys[0] === "@id"), `${path} has no @type`);
  for (const [key, value] of Object.entries(obj)) {
    assertValidNode(value, `${path}.${key}`);
    if (URL_KEYS.has(key)) {
      for (const v of [value].flat()) {
        assert.equal(typeof v, "string", `${path}.${key}`);
        assert.match(String(v), /^https:\/\/[^\s]+$/, `${path}.${key} not absolute: ${v}`);
      }
    }
  }
}

describe("canonicals", () => {
  it("each tablet canonicalises to its own absolute URL, all unique", () => {
    const canonicals = SOUNDCLOUD_TRACKS.map((t) => canonicalForQuery(`tablet=${t.slug}`));
    assert.equal(new Set(canonicals).size, SOUNDCLOUD_TRACKS.length);
    SOUNDCLOUD_TRACKS.forEach((t, i) => {
      assert.equal(canonicals[i], `https://atmanmusic.app/?tablet=${t.slug}`);
    });
    const pages = ["/", "/ebook", "/bowls"].map(pageCanonical);
    const every = [...pages, ...canonicals];
    assert.equal(new Set(every).size, every.length);
    for (const url of every) assert.match(url, /^https:\/\/atmanmusic\.app\//);
  });

  it("drops qc, debug and utm params; keeps only tablet", () => {
    assert.equal(
      canonicalForQuery("tablet=djinn&qc=1&debug=audio&utm_source=x&utm_medium=social"),
      "https://atmanmusic.app/?tablet=djinn",
    );
    assert.equal(canonicalForQuery("qc=1&utm_source=x"), HOME_URL);
    assert.equal(canonicalForQuery(""), HOME_URL);
    assert.equal(canonicalForQuery("tablet=%20djinn%20"), "https://atmanmusic.app/?tablet=djinn");
  });

  it("unknown tablets fall back to the home canonical, never to a junk URL", () => {
    assert.equal(canonicalForQuery("tablet=not-a-real-track"), HOME_URL);
    assert.equal(canonicalForQuery("tablet=%3Cscript%3E"), HOME_URL);
  });

  it("?daily=1 canonicalises to today's tablet (its stable URL)", () => {
    const dateKey = londonDateKey(new Date("2026-10-07T12:00:00Z"));
    const today = SOUNDCLOUD_TRACKS.find((t) => t.id === pickDailyTablet(ids, dateKey))!;
    assert.equal(canonicalForQuery("daily=1&utm_source=x", dateKey), `https://atmanmusic.app/?tablet=${today.slug}`);
  });

  it("plain routes: origin + path, no query or trailing slash", () => {
    assert.equal(pageCanonical("/"), "https://atmanmusic.app/");
    assert.equal(pageCanonical("/ebook?utm_source=x"), "https://atmanmusic.app/ebook");
    assert.equal(pageCanonical("/bowls/"), "https://atmanmusic.app/bowls");
    assert.equal(EBOOK_CANONICAL, "https://atmanmusic.app/ebook");
  });

  it("routes wire the canonical link; utility pages are noindex instead", () => {
    const index = read("src/routes/index.tsx");
    assert.match(index, /rel: "canonical", href: canonical/);
    assert.match(index, /homeCanonical\(/);
    assert.match(read("src/routes/ebook.tsx"), /rel: "canonical"/);
    assert.match(read("src/routes/bowls.tsx"), /rel: "canonical"/);
    for (const route of ["src/routes/download.tsx", "src/routes/login.tsx"]) {
      const src = read(route);
      assert.match(src, /NOINDEX_META/, route);
      assert.doesNotMatch(src, /rel: "canonical"/, route);
    }
  });
});

describe("og:url and twitter:url match the canonical", () => {
  it("tablet, daily and bare home: homeOgUrl() === homeCanonical()", () => {
    for (const source of ["tablet", "daily", "none"] as const) {
      for (const track of SOUNDCLOUD_TRACKS) {
        assert.equal(
          homeOgUrl({ source, slug: track.slug }),
          homeCanonical({ source, slug: track.slug }),
          `${source} ${track.slug}`,
        );
      }
    }
  });

  it("daily keeps the Today's tablet card text with the canonical URL", () => {
    const track = SOUNDCLOUD_TRACKS[0]!;
    const card = homeOgCard({ source: "daily", ...track, meaning: MEANINGS[track.id] ?? "" });
    assert.equal(card.title, `Today's tablet — ${track.title} — Atman Music`);
    assert.equal(card.url, `https://atmanmusic.app/?tablet=${track.slug}`);
  });

  it("the home route emits twitter:url from the same card url", () => {
    assert.match(read("src/routes/index.tsx"), /\{ name: "twitter:url", content: card\.url \}/);
    assert.match(read("src/routes/index.tsx"), /\{ property: "og:url", content: card\.url \}/);
  });
});

describe("catalogue titles", () => {
  it("are unique, so names, breadcrumbs and h2s tell tracks apart", () => {
    const seen = new Map<string, string>();
    for (const t of SOUNDCLOUD_TRACKS) {
      const key = t.title.trim().toLowerCase();
      assert.equal(seen.get(key), undefined, `${t.id} repeats the title of ${seen.get(key)}`);
      seen.set(key, t.id);
    }
    assert.equal(SOUNDCLOUD_TRACKS.find((t) => t.id === "infinite-spark-of-atoms-1")?.title, "Infinite Spark of Atoms (II)");
  });
});

describe("hero fits short phones", () => {
  it("defines phone-short and tightens the hero heading, meaning and CTA row with it", () => {
    assert.match(read("src/styles.css"), /@custom-variant phone-short \(@media \(max-width: 639\.98px\) and \(max-height: 740px\)\);/);
    const wall = read("src/components/track-wall.tsx");
    assert.match(wall, /<h2 className="[^"]*phone-short:truncate[^"]*">\s*\{current\.title\}/);
    assert.match(wall, /line-clamp-4[^"]*phone-short:line-clamp-2/);
    assert.match(wall, /sm:mt-10 phone-short:mt-4/);
  });
});

describe("JSON-LD", () => {
  it("home: WebSite + MusicGroup with the real profile links", () => {
    const description = homeDescription({ trackCount: SOUNDCLOUD_TRACKS.length, pricePence: 99 });
    const doc = renderAndParse(homeJsonLd(description));
    assert.equal(doc["@context"], "https://schema.org");
    assertValidNode(doc["@graph"], "home");
    const [site, artist] = doc["@graph"] as Record<string, unknown>[];
    assert.equal(site!["@type"], "WebSite");
    assert.equal(site!.url, HOME_URL);
    assert.equal(site!.description, description);
    assert.deepEqual(site!.publisher, { "@id": ARTIST_ID });
    assert.equal(artist!["@type"], "MusicGroup");
    assert.equal(artist!["@id"], ARTIST_ID);
    assert.equal(artist!.name, "Atman Music");
    assert.deepEqual(artist!.sameAs, [
      "https://soundcloud.com/esoteric_vibrations",
      "https://x.com/Hermes10wisdom",
    ]);
    assert.deepEqual(artist!.sameAs, [...ARTIST_SAME_AS]);
  });

  it("every tablet: valid MusicRecording + BreadcrumbList; offers only for tracks on sale", () => {
    const recordingIds = new Set<string>();
    for (const track of SOUNDCLOUD_TRACKS) {
      const doc = renderAndParse(tabletGraph(track));
      assertValidNode(doc["@graph"], track.slug);
      const [rec, artist, crumbs] = doc["@graph"] as Record<string, any>[];
      const url = `https://atmanmusic.app/?tablet=${track.slug}`;
      assert.equal(rec!["@type"], "MusicRecording");
      assert.equal(rec!.name, track.title);
      assert.equal(rec!.url, url);
      assert.equal(rec!.image, `https://atmanmusic.app${track.image}`);
      assert.deepEqual(rec!.byArtist, { "@type": "MusicGroup", "@id": ARTIST_ID, name: "Atman Music" });
      assert.equal(rec!.sameAs, track.permalink);
      assert.equal(rec!.dateCreated, recordedIsoMonth(track.recorded));
      assert.equal("duration" in rec!, false, "no duration in the catalogue, so none in JSON-LD");
      if (trackIsForSale(track)) {
        assert.deepEqual(rec!.offers, {
          "@type": "Offer",
          name: "Master MP3 download",
          price: "0.99",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
          url,
        });
      } else {
        assert.equal("offers" in rec!, false, track.slug);
      }
      assert.equal(artist!["@id"], ARTIST_ID);
      assert.equal(crumbs!["@type"], "BreadcrumbList");
      assert.deepEqual(
        crumbs!.itemListElement.map((i: any) => [i.position, i.name, i.item]),
        [
          [1, "Atman Music", HOME_URL],
          [2, track.title, url],
        ],
      );
      recordingIds.add(rec!["@id"]);
    }
    assert.equal(recordingIds.size, SOUNDCLOUD_TRACKS.length);
    assert.ok(SOUNDCLOUD_TRACKS.some((t) => !trackIsForSale(t)), "fixture: a not-for-sale track exists");
  });

  it("meanings with quotes, newlines and unicode survive script escaping", () => {
    const track = SOUNDCLOUD_TRACKS.find((t) => /[\u2019"]/.test(MEANINGS[t.id] ?? ""))!;
    const doc = renderAndParse(tabletGraph(track));
    const rec = doc["@graph"][0] as Record<string, string>;
    assert.equal(rec.description, MEANINGS[track.id]!.replace(/\s+/g, " ").trim());
    const hostile = renderAndParse(
      tabletJsonLd({ track, meaning: "</script><script>alert(1)</script> & more" }),
    );
    assert.equal((hostile["@graph"][0] as Record<string, string>).description, "</script><script>alert(1)</script> & more");
  });

  it("/ebook: Book with a free offer and Home › Book breadcrumb", () => {
    const doc = renderAndParse(ebookJsonLd());
    assertValidNode(doc["@graph"], "ebook");
    const book = bookJsonLd() as Record<string, any>;
    assert.equal(book["@type"], "Book");
    assert.equal(book.url, "https://atmanmusic.app/ebook");
    assert.equal(book.isAccessibleForFree, true);
    assert.equal(book.bookFormat, "https://schema.org/EBook");
    assert.equal(book.offers.price, "0");
    assert.equal(book.offers.priceCurrency, "GBP");
    assert.deepEqual(
      book.hasPart.map((p: any) => p.name),
      ["The Kybalion", "The Divine Pymander", "The Emerald Tablet", "The Wisdom of Solomon"],
    );
    const crumbs = doc["@graph"][2] as Record<string, any>;
    assert.equal(crumbs.itemListElement[1].item, "https://atmanmusic.app/ebook");
  });

  it("/bowls: breadcrumb", () => {
    const doc = renderAndParse(pageBreadcrumbJsonLd("Sound bowls", "/bowls"));
    assertValidNode(doc["@graph"], "bowls");
    assert.equal((doc["@graph"][0] as any).itemListElement[1].item, "https://atmanmusic.app/bowls");
  });
});

describe("home description and verification", () => {
  it("is richer, factual and fits a search snippet", () => {
    const text = homeDescription({ trackCount: SOUNDCLOUD_TRACKS.length, pricePence: DEFAULT_MASTER_PRICE_PENCE });
    assert.match(text, new RegExp(`${SOUNDCLOUD_TRACKS.length} tracks`));
    assert.match(text, /£0\.99/);
    assert.match(text, /free Hermetic ebook/);
    assert.ok(text.length >= 120 && text.length <= 170, `length ${text.length}`);
  });

  it("recorded months parse to ISO year-month", () => {
    assert.equal(recordedIsoMonth("September 2026"), "2026-09");
    assert.equal(recordedIsoMonth("February 2019"), "2019-02");
    assert.equal(recordedIsoMonth("Spring 2026"), undefined);
    assert.equal(recordedIsoMonth(undefined), undefined);
    for (const t of SOUNDCLOUD_TRACKS) assert.match(recordedIsoMonth(t.recorded) ?? "", /^\d{4}-\d{2}$/, t.id);
  });

  it("GOOGLE_SITE_VERIFICATION: tag when set, nothing when empty", () => {
    assert.deepEqual(siteVerificationMeta("abc123"), [{ name: "google-site-verification", content: "abc123" }]);
    assert.deepEqual(siteVerificationMeta("  abc123  "), [{ name: "google-site-verification", content: "abc123" }]);
    assert.deepEqual(siteVerificationMeta(""), []);
    assert.deepEqual(siteVerificationMeta("   "), []);
    assert.deepEqual(siteVerificationMeta(undefined), []);
    assert.match(read("vite.config.ts"), /__GOOGLE_SITE_VERIFICATION__: JSON\.stringify\(String\(process\.env\.GOOGLE_SITE_VERIFICATION/);
    assert.match(read("src/routes/__root.tsx"), /\.\.\.siteVerificationMeta\(GOOGLE_SITE_VERIFICATION\)/);
  });
});
