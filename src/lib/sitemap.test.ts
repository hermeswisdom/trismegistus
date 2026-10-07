import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";
import {
  buildSitemap,
  parseLastmods,
  sitemapForRepo,
  trackBlocks,
  trackIds,
} from "../../scripts/generate-sitemap.mjs";
import { homeCanonical, pageCanonical } from "./seo.ts";

const read = (p: string) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);

describe("public/sitemap.xml", () => {
  it("lists every track and matches the generator (run scripts/generate-sitemap.mjs)", () => {
    const ids = trackIds(read("src/lib/soundcloud-tracks.ts"));
    assert.deepEqual(ids, SOUNDCLOUD_TRACKS.map((t) => t.id));
    assert.deepEqual(trackBlocks(read("src/lib/soundcloud-tracks.ts")).map((b) => b.id), ids);
    assert.equal(read("public/sitemap.xml"), sitemapForRepo().xml);
  });

  it("includes the indexable routes and per-track deep links", () => {
    const xml = read("public/sitemap.xml");
    assert.match(xml, /<loc>https:\/\/atmanmusic\.app\/<\/loc>/);
    assert.match(xml, /<loc>https:\/\/atmanmusic\.app\/ebook<\/loc>/);
    assert.match(xml, /<loc>https:\/\/atmanmusic\.app\/bowls<\/loc>/);
    assert.match(xml, new RegExp(`/\\?tablet=${SOUNDCLOUD_TRACKS[0]!.id}<`));
    assert.equal(locs(xml).length, SOUNDCLOUD_TRACKS.length + 3);
  });

  it("has no unwanted URLs: no noindex utility pages, api, qc/utm or daily params", () => {
    const all = locs(read("public/sitemap.xml"));
    for (const loc of all) {
      assert.ok(loc.startsWith("https://atmanmusic.app/"), loc);
      assert.doesNotMatch(loc, /\/(download|login|api)\b/, loc);
      assert.doesNotMatch(loc, /[?&](qc|debug|utm_[a-z]+|daily|session_id|receipt)=/, loc);
      const query = new URL(loc).searchParams;
      assert.deepEqual([...query.keys()].filter((k) => k !== "tablet"), [], loc);
    }
    assert.equal(new Set(all).size, all.length, "duplicate <loc>");
  });

  it("lists each URL exactly as its page canonicalises", () => {
    const all = new Set(locs(read("public/sitemap.xml")));
    assert.ok(all.has(pageCanonical("/")));
    assert.ok(all.has(pageCanonical("/ebook")));
    assert.ok(all.has(pageCanonical("/bowls")));
    for (const track of SOUNDCLOUD_TRACKS) {
      assert.ok(all.has(homeCanonical({ source: "tablet", slug: track.slug })), track.slug);
    }
  });

  it("gives every URL a real YYYY-MM-DD lastmod that is not in the future", () => {
    const xml = read("public/sitemap.xml");
    const lastmods = parseLastmods(xml);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    assert.equal(lastmods.size, locs(xml).length);
    for (const [loc, day] of lastmods) {
      assert.match(day, /^\d{4}-\d{2}-\d{2}$/, loc);
      assert.ok(!Number.isNaN(Date.parse(`${day}T00:00:00Z`)), loc);
      assert.ok(day <= tomorrow, `${loc} ${day}`);
    }
    const newestTablet = [...lastmods]
      .filter(([loc]) => loc.includes("?tablet="))
      .map(([, d]) => d)
      .sort()
      .at(-1);
    assert.equal(lastmods.get("https://atmanmusic.app/"), newestTablet);
  });

  it("omits lastmod when no date is known and keeps known ones", () => {
    const bare = buildSitemap(["djinn"]);
    assert.doesNotMatch(bare, /<lastmod>/);
    const dated = buildSitemap(["djinn"], new Map([["https://atmanmusic.app/?tablet=djinn", "2026-09-23"]]));
    assert.match(dated, /<loc>https:\/\/atmanmusic\.app\/\?tablet=djinn<\/loc>\n {4}<lastmod>2026-09-23<\/lastmod>/);
    assert.deepEqual([...parseLastmods(dated)], [["https://atmanmusic.app/?tablet=djinn", "2026-09-23"]]);
  });
});

describe("public/robots.txt", () => {
  it("allows the site, disallows /api/ and points at the sitemap", () => {
    const txt = read("public/robots.txt");
    assert.match(txt, /^User-agent: \*$/m);
    assert.match(txt, /^Allow: \/$/m);
    assert.match(txt, /^Disallow: \/api\/$/m);
    assert.match(txt, /^Sitemap: https:\/\/atmanmusic\.app\/sitemap\.xml$/m);
  });
});
