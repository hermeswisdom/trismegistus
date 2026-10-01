#!/usr/bin/env node
/**
 * Upload a private raw master to Vercel Blob.
 *
 *   node scripts/upload-master.mjs <file.mp3> <slug>
 *   node scripts/upload-master.mjs --fixture
 *
 * Requires BLOB_READ_WRITE_TOKEN (or a linked Vercel Blob store).
 * After upload, set downloadKey: "masters/<slug>.mp3" on that track in
 * src/lib/soundcloud-tracks.ts (or MASTER_SALE_SLUGS) so the Buy button appears.
 *
 * Do not rip SoundCloud. Only upload files Atman owns.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function masterBlobPath(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`invalid slug: ${slug}`);
  }
  return `masters/${slug}.mp3`;
}

export function catalogSnippet(slug) {
  return `    downloadKey: "${masterBlobPath(slug)}",`;
}

/** Minimal silent MPEG frames — dry-run fixture only, not a real master. */
export function silentMasterMp3() {
  const id3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const frame = Buffer.alloc(144, 0);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  const parts = [id3];
  for (let i = 0; i < 8; i += 1) parts.push(frame);
  return Buffer.concat(parts);
}

async function writeFixture() {
  const dir = join(root, "fixtures", "masters");
  await mkdir(dir, { recursive: true });
  const path = join(dir, "the-sleepers-waking.mp3");
  await writeFile(path, silentMasterMp3());
  return path;
}

async function upload(filePath, slug) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token && !process.env.BLOB_STORE_ID) {
    throw new Error(
      "Set BLOB_READ_WRITE_TOKEN (Vercel Blob). Create a Private store on the project.",
    );
  }
  const { put } = await import("@vercel/blob");
  const body = await readFile(filePath);
  const pathname = masterBlobPath(slug);
  const result = await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "audio/mpeg",
    token,
  });
  return { pathname, url: result.url };
}

function usage() {
  console.log(`Usage:
  node scripts/upload-master.mjs <file.mp3> <slug>
  node scripts/upload-master.mjs --fixture

Example:
  node scripts/upload-master.mjs ~/Music/sleepers-master.mp3 the-sleepers-waking
`);
}

async function main(argv = process.argv.slice(2)) {
  if (argv[0] === "--help" || argv[0] === "-h" || argv.length === 0) {
    usage();
    return { ok: true, help: true };
  }
  if (argv[0] === "--fixture") {
    const path = await writeFixture();
    console.log(`[masters] wrote silent fixture ${path}`);
    console.log("[masters] not a real master — dry-run only.");
    return { ok: true, fixture: path };
  }
  const [filePath, slug] = argv;
  if (!filePath || !slug) {
    usage();
    process.exitCode = 1;
    return { ok: false };
  }
  if (!filePath.toLowerCase().endsWith(".mp3")) {
    throw new Error("Upload an .mp3 you own. SoundCloud streams are not accepted.");
  }
  const pathname = masterBlobPath(slug);
  const uploaded = await upload(filePath, slug);
  console.log(`[masters] uploaded ${basename(filePath)} → ${uploaded.pathname}`);
  console.log(`[masters] add this to the track in src/lib/soundcloud-tracks.ts:`);
  console.log(catalogSnippet(slug));
  console.log(`[masters] or set MASTER_SALE_SLUGS=${slug} and redeploy.`);
  return { ok: true, pathname };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(`[masters] ${err?.message || err}`);
    process.exit(1);
  });
}
