#!/usr/bin/env node
/**
 * Upload a private raw master MP3 to Vercel Blob.
 *
 *   BLOB_READ_WRITE_TOKEN=vercel_blob_… node scripts/upload-master.mjs ./masters/the-sleepers-waking.mp3 the-sleepers-waking
 *
 * Path on Blob: masters/<slug>.mp3
 * Then set `downloadKey: "<slug>"` on that catalog row in src/lib/soundcloud-tracks.ts
 * (or confirm it is already set) and redeploy.
 */
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function loadLocalEnv() {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return;
  for (const name of [".env.local", ".env"]) {
    try {
      const text = await readFile(new URL(`../${name}`, import.meta.url), "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      /* file optional */
    }
  }
}

function slugFromName(filePath) {
  return basename(filePath)
    .replace(/\.mp3$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function masterUploadPath(slug) {
  const clean = String(slug ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^masters\//, "")
    .replace(/\.mp3$/i, "");
  if (!clean) throw new Error("slug is required");
  return `masters/${clean}.mp3`;
}

async function main() {
  await loadLocalEnv();
  const file = process.argv[2];
  const slug = process.argv[3] || (file ? slugFromName(file) : "");
  if (!file || !slug) {
    console.error(
      "usage: node scripts/upload-master.mjs <file.mp3> <catalog-slug>",
    );
    console.error(
      "example: node scripts/upload-master.mjs ./the-sleepers-waking.mp3 the-sleepers-waking",
    );
    process.exit(1);
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    console.error(
      "BLOB_READ_WRITE_TOKEN is required. Create a Vercel Blob store and paste the token.",
    );
    process.exit(1);
  }

  const pathname = masterUploadPath(slug);
  const bytes = await readFile(resolve(file));
  if (bytes.length < 32) {
    console.error("File looks too small to be an MP3 master.");
    process.exit(1);
  }

  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, bytes, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "audio/mpeg",
    token,
  });

  console.log(`Uploaded ${pathname}`);
  console.log(`url: ${blob.url}`);
  console.log(`Set downloadKey: "${slug}" on that track in src/lib/soundcloud-tracks.ts`);
  console.log("SoundCloud streams stay free. Do not rip them.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
