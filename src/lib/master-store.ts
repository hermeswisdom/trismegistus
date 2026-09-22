import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@/lib/env.server";
import {
  FIXTURE_TRACK_ID,
  contentDisposition,
  defaultMasterDownloadKey,
  masterFilename,
  sanitizeMasterDownloadKey,
} from "@/lib/masters";
import { getTrack } from "@/lib/rooms";
import { masterDryRunEnabled } from "@/lib/purchases";

export type MasterBytes = {
  body: Blob | ReadableStream<Uint8Array>;
  contentType: string;
  filename: string;
  fixture: boolean;
  source: "blob" | "local" | "fixture";
};

function mp3Blob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "audio/mpeg" });
}

const FIXTURE_SLUG = "the-sleepers-waking";

/** Tiny silent MPEG frame so dry-run can download without a real master. */
export function silentMasterMp3(): Uint8Array {
  const id3 = new Uint8Array([
    0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  const frameSize = 144;
  const frame = new Uint8Array(frameSize);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0x00;
  const out = new Uint8Array(id3.length + frame.length * 8);
  out.set(id3, 0);
  for (let i = 0; i < 8; i += 1) {
    out.set(frame, id3.length + i * frame.length);
  }
  return out;
}

function workspaceRoot(): string {
  return dirname(fileURLToPath(new URL("../..", import.meta.url)));
}

function slugFromKey(downloadKey: string): string | undefined {
  const match = /^masters\/([a-z0-9]+(?:-[a-z0-9]+)*)\.mp3$/.exec(downloadKey);
  return match?.[1];
}

async function readLocalMaster(downloadKey: string): Promise<Uint8Array | null> {
  const slug = slugFromKey(downloadKey);
  if (!slug) return null;
  const root = workspaceRoot();
  const candidates = [
    join(root, "masters", `${slug}.mp3`),
    join(root, "fixtures", "masters", `${slug}.mp3`),
  ];
  for (const path of candidates) {
    try {
      return new Uint8Array(await readFile(path));
    } catch {
      /* try next */
    }
  }
  return null;
}

function blobConfigured(): boolean {
  return Boolean(env("BLOB_READ_WRITE_TOKEN") || env("BLOB_STORE_ID"));
}

async function readBlobMaster(downloadKey: string): Promise<MasterBytes | null> {
  if (!blobConfigured()) return null;
  try {
    const { get } = await import("@vercel/blob");
    const result = await get(downloadKey, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const track = getTrack(slugFromKey(downloadKey) ?? "") ?? getTrack(FIXTURE_TRACK_ID);
    return {
      body: result.stream,
      contentType: result.blob.contentType || "audio/mpeg",
      filename: masterFilename(track ?? { title: slugFromKey(downloadKey) ?? "master", slug: slugFromKey(downloadKey) ?? "master" }),
      fixture: false,
      source: "blob",
    };
  } catch {
    return null;
  }
}

export async function loadMaster(downloadKey: string): Promise<MasterBytes | null> {
  const key = sanitizeMasterDownloadKey(downloadKey);
  if (!key) return null;
  const track =
    getTrack(slugFromKey(key) ?? "") ??
    getTrack(FIXTURE_TRACK_ID);
  const filename = masterFilename(
    track ?? { title: slugFromKey(key) ?? "master", slug: slugFromKey(key) ?? "master" },
  );

  const fromBlob = await readBlobMaster(key);
  if (fromBlob) return fromBlob;

  const local = await readLocalMaster(key);
  if (local) {
    return {
      body: mp3Blob(local),
      contentType: "audio/mpeg",
      filename,
      fixture: key === defaultMasterDownloadKey(FIXTURE_SLUG),
      source: "local",
    };
  }

  if (masterDryRunEnabled() && key === defaultMasterDownloadKey(FIXTURE_SLUG)) {
    return {
      body: mp3Blob(silentMasterMp3()),
      contentType: "audio/mpeg",
      filename,
      fixture: true,
      source: "fixture",
    };
  }

  return null;
}

export function masterResponseHeaders(master: MasterBytes): Headers {
  const headers = new Headers();
  headers.set("Content-Type", master.contentType);
  headers.set("Content-Disposition", contentDisposition(master.filename));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Atman-Master-Source", master.source);
  if (master.fixture) headers.set("X-Atman-Master-Fixture", "1");
  return headers;
}
