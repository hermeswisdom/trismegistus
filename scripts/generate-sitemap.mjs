#!/usr/bin/env node
// Writes public/sitemap.xml from the track catalogue (src/lib/soundcloud-tracks.ts).
// Runs before `vite build`; `--check` exits 1 if the committed file is stale.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_ORIGIN = "https://atmanmusic.app";
export const STATIC_ROUTES = ["/", "/ebook", "/download"];

/** @param {string} source @returns {string[]} */
export function trackIds(source) {
  return [...source.matchAll(/^\s{4}id:\s*"([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

/** @param {string[]} ids @returns {string} */
export function buildSitemap(ids) {
  const urls = [
    ...STATIC_ROUTES.map((p) => ({ loc: `${SITE_ORIGIN}${p}`, priority: p === "/" ? "1.0" : "0.6" })),
    ...ids.map((id) => ({ loc: `${SITE_ORIGIN}/?tablet=${encodeURIComponent(id)}`, priority: "0.8" })),
  ];
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = fs.readFileSync(path.join(root, "src/lib/soundcloud-tracks.ts"), "utf8");
  const ids = trackIds(source);
  if (ids.length === 0) throw new Error("generate-sitemap: no track ids found");
  const xml = buildSitemap(ids);
  const out = path.join(root, "public/sitemap.xml");
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
    if (current !== xml) {
      console.error("public/sitemap.xml is stale: run node scripts/generate-sitemap.mjs");
      process.exit(1);
    }
    console.log(`sitemap ok (${ids.length} tracks)`);
  } else {
    fs.writeFileSync(out, xml);
    console.log(`wrote public/sitemap.xml (${ids.length} tracks + ${STATIC_ROUTES.length} routes)`);
  }
}
