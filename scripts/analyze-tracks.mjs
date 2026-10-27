#!/usr/bin/env node
/**
 * Analyse every stream for the mood Auto Mix and write src/data/track-analysis.json.
 *
 *   npm run analyze:tracks                      # whole catalogue
 *   npm run analyze:tracks -- --slug <slug>     # one track (repeatable / comma list)
 *   npm run analyze:tracks -- --rebuild         # no audio: re-apply rules + overrides to stored features
 *   npm run analyze:tracks -- --cache <dir>     # where streams are downloaded (default $TMPDIR/atman-analysis)
 *
 * Reads streams/<slug>.mp3 from the private Blob store with
 * BLOB_READ_WRITE_TOKEN (same `get(..., { access: "private" })` call as
 * scripts/transcode-streams.mjs), measures each file with
 * scripts/analyze_tracks.py (Python 3 + librosa, essentia when installed;
 * set ANALYZE_PYTHON to pick the interpreter), then normalises energy and
 * brightness across the whole catalogue and applies the mood rules in
 * scripts/track-analysis-core.mjs. src/data/track-analysis-overrides.json is
 * merged on top. A --slug run keeps every other entry and re-normalises with
 * their stored raw features, so it is cheap to run per release.
 *
 * Slugs: src/lib/stream-manifest.ts (every track with a stream), plus any
 * --slug given even if the manifest does not list it yet.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnalysis } from "./track-analysis-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "src/data/track-analysis.json");
const OVERRIDES = join(root, "src/data/track-analysis-overrides.json");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** @param {string[]} argv @param {string} name */
function args(argv, name) {
  /** @type {string[]} */
  const out = [];
  argv.forEach((a, i) => {
    if (a === name && argv[i + 1]) out.push(...argv[i + 1].split(","));
    else if (a.startsWith(`${name}=`))
      out.push(...a.slice(name.length + 1).split(","));
  });
  return out.filter(Boolean);
}

/** @param {string} source @returns {Record<string, string>} slug → title */
export function catalogueTitles(source) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const block of source.split(/\n\s{2}\{\n/).slice(1)) {
    const title = /\btitle:\s*"((?:[^"\\]|\\.)*)"/.exec(block)?.[1];
    const slug = /\bslug:\s*"([^"]+)"/.exec(block)?.[1];
    if (title && slug) out[slug] = title.replace(/\\"/g, '"');
  }
  return out;
}

/** @param {string} source */
export function manifestSlugs(source) {
  return [...source.matchAll(/^\s+"([a-z0-9-]+)",$/gm)].map((m) => m[1]);
}

/** @param {string} slug @param {string} dest @param {string} token */
async function fetchStream(slug, dest, token) {
  const { get } = await import("@vercel/blob");
  const result = await get(`streams/${slug}.mp3`, { access: "private", token });
  if (!result || result.statusCode !== 200 || !result.stream)
    throw new Error(`stream missing in Blob: streams/${slug}.mp3`);
  await writeFile(
    dest,
    Buffer.from(await new Response(result.stream).arrayBuffer()),
  );
}

/**
 * Run the Python analyser over files; resolves slug → raw record.
 * @param {string} python @param {{ slug: string, file: string }[]} items
 * @returns {Promise<Record<string, any>>}
 */
function pythonAnalyse(python, items) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      python,
      [
        join(root, "scripts/analyze_tracks.py"),
        ...items.map((i) => `${i.slug}=${i.file}`),
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    /** @type {Record<string, any>} */
    const out = {};
    let buf = "";
    let err = "";
    child.stdout.on("data", (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("{")) continue;
        const rec = JSON.parse(line);
        out[rec.slug] = rec;
        console.log(
          `[analyze] ${rec.slug} ${rec.error ? `FAILED ${rec.error}` : `${rec.bpm_raw} bpm ${rec.key} ${rec.mode}`}`,
        );
      }
    });
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(out)
        : reject(
            new Error(
              `analyze_tracks.py exited ${code}: ${err.trim().slice(-500)}`,
            ),
          ),
    );
  });
}

/** @param {string} path */
async function readJson(path, fallback = {}) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function main(argv = process.argv.slice(2)) {
  const started = Date.now();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const only = args(argv, "--slug");
  for (const s of only)
    if (!SLUG_RE.test(s)) throw new Error(`invalid slug: ${s}`);
  const cache = args(argv, "--cache")[0] ?? join(tmpdir(), "atman-analysis");
  const jobs = Number(args(argv, "--jobs")[0] ?? 6);
  const python =
    process.env.ANALYZE_PYTHON ??
    (existsSync(join(root, ".venv-analysis/bin/python"))
      ? join(root, ".venv-analysis/bin/python")
      : "python3");
  await mkdir(cache, { recursive: true });

  const titles = catalogueTitles(
    await readFile(join(root, "src/lib/soundcloud-tracks.ts"), "utf8"),
  );
  const manifest = manifestSlugs(
    await readFile(join(root, "src/lib/stream-manifest.ts"), "utf8"),
  );
  const rebuild = argv.includes("--rebuild");
  const slugs = rebuild ? [] : only.length ? only : manifest;

  // Download (cached by slug; delete the cache dir to force a refetch).
  /** @type {Record<string, string>} */
  const failures = {};
  /** @type {{ slug: string, file: string }[]} */
  const ready = [];
  const queue = [...slugs];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let slug = queue.shift(); slug; slug = queue.shift()) {
        const file = join(cache, `${slug}.mp3`);
        try {
          if (!existsSync(file)) {
            if (!token)
              throw new Error("no cached stream and no BLOB_READ_WRITE_TOKEN");
            await fetchStream(slug, file, token);
          }
          ready.push({ slug, file });
        } catch (e) {
          failures[slug] = `download: ${/** @type {Error} */ (e).message}`;
          console.error(
            `[analyze] ${slug} download failed: ${/** @type {Error} */ (e).message}`,
          );
        }
      }
    }),
  );
  console.log(
    `[analyze] ${ready.length}/${slugs.length} streams ready in ${cache}`,
  );

  // Analyse in parallel Python workers.
  const chunks = Array.from(
    { length: Math.max(1, Math.min(jobs, ready.length)) },
    (_, i) => ready.filter((_, j) => j % jobs === i),
  );
  const results = Object.assign(
    {},
    ...(await Promise.all(
      chunks.filter((c) => c.length).map((c) => pythonAnalyse(python, c)),
    )),
  );
  const analyzedAt = new Date().toISOString().slice(0, 10);

  // Merge with previously stored raw features (so --slug re-normalises against the catalogue).
  const previous = await readJson(OUT);
  /** @type {Record<string, any>} */
  const raw = {};
  for (const [slug, entry] of Object.entries(previous))
    if (entry?.raw && (only.length || rebuild || manifest.includes(slug)))
      raw[slug] = entry.raw;
  for (const [slug, rec] of Object.entries(results)) {
    if (rec.error) {
      failures[slug] = rec.error;
      continue;
    }
    const { slug: _s, ...features } = rec;
    raw[slug] = { ...features, analyzed_at: analyzedAt };
  }

  const analysis = buildAnalysis(raw, await readJson(OVERRIDES), titles);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(analysis, null, 2)}\n`);

  /** @type {Record<string, number>} */
  const moods = {};
  for (const e of Object.values(analysis))
    moods[e.mood] = (moods[e.mood] ?? 0) + 1;
  console.log(
    `[analyze] wrote ${Object.keys(analysis).length} tracks → src/data/track-analysis.json`,
  );
  console.log(`[analyze] moods: ${JSON.stringify(moods)}`);
  const failed = Object.keys(failures);
  if (failed.length)
    console.error(
      `[analyze] ${failed.length} failed: ${failed.map((s) => `${s} (${failures[s]})`).join("; ")}`,
    );
  console.log(`[analyze] ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (failed.length) process.exitCode = 1;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(`[analyze] ${err?.message || err}`);
    process.exit(1);
  });
}
