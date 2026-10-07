#!/usr/bin/env node
// Writes public/sitemap.xml from the track catalogue (src/lib/soundcloud-tracks.ts).
// Runs before `vite build`; `--check` exits 1 if the committed file is stale.
//
// Only indexable, canonical URLs: the home page, /ebook, /bowls and one
// /?tablet=<id> per track (each tablet page canonicalises to itself).
// /download (receipt redemption) and /login are noindex, so they stay out.
//
// lastmod is a real modification date (YYYY-MM-DD, UTC) from git history:
//   tablet  = newest commit touching that track's catalogue entry, its meaning
//             line (src/lib/meanings.ts) or its cover art
//   home    = newest tablet date (the wall is the catalogue)
//   /ebook  = newest commit touching src/lib/ebook.ts or public/ebook/
//   /bowls  = newest commit touching src/lib/bowls.ts
// Without full history (a shallow CI clone, no .git) the dates already in the
// committed public/sitemap.xml are kept, so a build never invents or drops them.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_ORIGIN = "https://atmanmusic.app";
export const STATIC_ROUTES = ["/", "/ebook", "/bowls"];
const CATALOGUE = "src/lib/soundcloud-tracks.ts";
const MEANINGS = "src/lib/meanings.ts";
const SITEMAP = "public/sitemap.xml";
const PAGE_SOURCES = {
  "/ebook": ["src/lib/ebook.ts", "public/ebook"],
  "/bowls": ["src/lib/bowls.ts"],
};

/** @param {string} source @returns {string[]} */
export function trackIds(source) {
  return [...source.matchAll(/^\s{4}id:\s*"([a-z0-9-]+)"/gm)].map((m) => m[1]);
}

/**
 * Each catalogue object: id, image and its 1-based line range in the file.
 * @param {string} source
 * @returns {{ id: string, image?: string, start: number, end: number }[]}
 */
export function trackBlocks(source) {
  const lines = source.split("\n");
  const blocks = [];
  let open = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s{2}\{\s*$/.test(lines[i])) open = i;
    else if (open >= 0 && /^\s{2}\},?\s*$/.test(lines[i])) {
      const body = lines.slice(open, i + 1).join("\n");
      const id = /^\s{4}id:\s*"([a-z0-9-]+)"/m.exec(body)?.[1];
      const image = /^\s{4}image:\s*"([^"]+)"/m.exec(body)?.[1];
      if (id) blocks.push({ id, image, start: open + 1, end: i + 1 });
      open = -1;
    }
  }
  return blocks;
}

/** @param {number} seconds */
export function isoDay(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** @param {string[]} args */
function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** True only with a full (non-shallow) history: blame on a shallow clone lies. */
export function hasFullGitHistory() {
  try {
    return git(["rev-parse", "--is-shallow-repository"]).trim() === "false";
  } catch {
    return false;
  }
}

/**
 * Committer time (s) per 1-based line; uncommitted lines read as now.
 * @param {string} file
 * @returns {number[]}
 */
function blameTimes(file) {
  const out = git(["blame", "--line-porcelain", "--", file]);
  const times = [0];
  for (const line of out.split("\n")) {
    if (line.startsWith("committer-time ")) times.push(Number(line.slice(15)));
  }
  return times;
}

/** @param {string[]} paths @returns {number} */
function lastCommitTime(paths) {
  const out = git(["log", "-1", "--format=%ct", "--", ...paths]).trim();
  return out ? Number(out) : 0;
}

/** @returns {Map<string, string>} loc → lastmod from git, or empty without history. */
export function gitLastmods(source = fs.readFileSync(path.join(root, CATALOGUE), "utf8")) {
  const result = new Map();
  if (!hasFullGitHistory()) return result;
  const catalogueTimes = blameTimes(CATALOGUE);
  const meaningTimes = blameTimes(MEANINGS);
  const meaningLines = fs.readFileSync(path.join(root, MEANINGS), "utf8").split("\n");
  let newest = 0;
  for (const block of trackBlocks(source)) {
    let t = Math.max(...catalogueTimes.slice(block.start, block.end + 1));
    const key = `  "${block.id}":`;
    const at = meaningLines.findIndex((line) => line.startsWith(key));
    if (at >= 0) t = Math.max(t, meaningTimes[at + 1] ?? 0);
    if (block.image) t = Math.max(t, lastCommitTime([`public${block.image}`]));
    if (t > 0) result.set(tabletLoc(block.id), isoDay(t));
    newest = Math.max(newest, t);
  }
  if (newest > 0) result.set(`${SITE_ORIGIN}/`, isoDay(newest));
  for (const [route, paths] of Object.entries(PAGE_SOURCES)) {
    const t = lastCommitTime(paths);
    if (t > 0) result.set(`${SITE_ORIGIN}${route}`, isoDay(t));
  }
  return result;
}

/**
 * loc → lastmod already in a sitemap document.
 * @param {string} xml
 * @returns {Map<string, string>}
 */
export function parseLastmods(xml) {
  const result = new Map();
  for (const m of String(xml).matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    result.set(m[1], m[2]);
  }
  return result;
}

/** @param {string} id */
export function tabletLoc(id) {
  return `${SITE_ORIGIN}/?tablet=${encodeURIComponent(id)}`;
}

/**
 * @param {string[]} ids
 * @param {Map<string, string>} [lastmods] loc → YYYY-MM-DD
 * @returns {string}
 */
export function buildSitemap(ids, lastmods = new Map()) {
  const urls = [
    ...STATIC_ROUTES.map((p) => ({ loc: `${SITE_ORIGIN}${p}`, priority: p === "/" ? "1.0" : "0.6" })),
    ...ids.map((id) => ({ loc: tabletLoc(id), priority: "0.8" })),
  ];
  const body = urls
    .map((u) => {
      const lastmod = lastmods.get(u.loc);
      return (
        `  <url>\n    <loc>${u.loc}</loc>\n` +
        (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "") +
        `    <priority>${u.priority}</priority>\n  </url>`
      );
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** The sitemap this checkout should have: git dates, else the committed ones. */
export function sitemapForRepo() {
  const source = fs.readFileSync(path.join(root, CATALOGUE), "utf8");
  const ids = trackIds(source);
  if (ids.length === 0) throw new Error("generate-sitemap: no track ids found");
  const out = path.join(root, SITEMAP);
  const committed = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  const fromGit = gitLastmods(source);
  const lastmods = fromGit.size > 0 ? fromGit : parseLastmods(committed);
  return { ids, xml: buildSitemap(ids, lastmods), committed, out, fromGit: fromGit.size > 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ids, xml, committed, out, fromGit } = sitemapForRepo();
  const dates = fromGit ? "git dates" : "committed dates";
  if (process.argv.includes("--check")) {
    if (committed !== xml) {
      console.error("public/sitemap.xml is stale: run node scripts/generate-sitemap.mjs");
      process.exit(1);
    }
    console.log(`sitemap ok (${ids.length} tracks, ${dates})`);
  } else {
    fs.writeFileSync(out, xml);
    console.log(`wrote public/sitemap.xml (${ids.length} tracks + ${STATIC_ROUTES.length} routes, ${dates})`);
  }
}
