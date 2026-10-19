/**
 * Pure logic for the Phase 1 admin upload queue (no server/client imports, so
 * `node --test` can load this directly — same split as visitor-count.ts).
 *
 * Queue items are NOT wall catalogue tracks: nothing here touches TRACKS /
 * soundcloud-tracks, and queue rows are only ever read by admin-gated code.
 */

export const QUEUE_STATUSES = ["waiting", "in_progress", "live", "rejected"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const MAX_MP3_BYTES = 25 * 1024 * 1024; // ~25 MB — a 5 MB master fits easily
export const MAX_COVER_BYTES = 10 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_FILENAME_LENGTH = 255;

export const MP3_CONTENT_TYPES = ["audio/mpeg", "audio/mp3", "audio/x-mp3"] as const;
export const COVER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const COVER_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const COVER_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

/**
 * Default admin allowlist when ADMIN_EMAILS is unset. This is Atman's public
 * account email for this app (also the commit author), not a secret. In
 * production prefer setting ADMIN_EMAILS explicitly (comma/space separated);
 * a set-but-empty value is treated as unset, matching env() elsewhere.
 */
export const DEFAULT_ADMIN_EMAILS: readonly string[] = ["smlc@me.com"];

export function parseAdminEmails(raw: string | null | undefined): string[] {
  if (raw == null || !raw.trim()) return [...DEFAULT_ADMIN_EMAILS];
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(
  email: string | null | undefined,
  rawAllowlist?: string | null,
): boolean {
  if (!email) return false;
  return parseAdminEmails(rawAllowlist).includes(email.trim().toLowerCase());
}

export function isQueueStatus(v: unknown): v is QueueStatus {
  return typeof v === "string" && (QUEUE_STATUSES as readonly string[]).includes(v);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isQueueId(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function extensionOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Unguessable Blob pathname: queue/<uuid>.<ext> — never the original name. */
export function queueBlobPath(kind: "mp3" | "cover", id: string, filenameOrType: string): string | null {
  if (!isQueueId(id)) return null;
  if (kind === "mp3") return `queue/${id}.mp3`;
  const ext = COVER_EXT_BY_TYPE[filenameOrType] ?? extensionOf(filenameOrType).replace("jpeg", "jpg");
  if (!COVER_EXTS.has(ext)) return null;
  return `queue/${id}-cover.${ext === "jpeg" ? "jpg" : ext}`;
}

export function isQueueBlobPath(pathname: unknown, kind: "mp3" | "cover", id: string): boolean {
  if (typeof pathname !== "string" || !isQueueId(id)) return false;
  if (kind === "mp3") return pathname === `queue/${id}.mp3`;
  return new RegExp(`^queue/${id}-cover\\.(jpg|png|webp)$`).test(pathname);
}

export function titleFromFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const noExt = base.replace(/\.[a-z0-9]+$/i, "");
  const cleaned = noExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "Untitled").slice(0, MAX_TITLE_LENGTH);
}

export function cleanTitleOverride(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, MAX_TITLE_LENGTH) : null;
}

export function cleanNotes(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, MAX_NOTES_LENGTH) : null;
}

export type FileMeta = { filename: string; contentType?: string | null; sizeBytes: number };
export type Validation = { ok: true } | { ok: false; error: string };

export function validateMp3File(meta: FileMeta): Validation {
  if (extensionOf(meta.filename) !== "mp3")
    return { ok: false, error: "Choose an .mp3 file." };
  const type = (meta.contentType ?? "").toLowerCase();
  if (type && !(MP3_CONTENT_TYPES as readonly string[]).includes(type) && !type.startsWith("audio/"))
    return { ok: false, error: "That file is not an audio file." };
  if (!Number.isFinite(meta.sizeBytes) || meta.sizeBytes <= 0)
    return { ok: false, error: "That MP3 looks empty." };
  if (meta.sizeBytes > MAX_MP3_BYTES)
    return { ok: false, error: `MP3 is over the ${Math.round(MAX_MP3_BYTES / 1024 / 1024)} MB limit.` };
  return { ok: true };
}

export function validateCoverFile(meta: FileMeta): Validation {
  const ext = extensionOf(meta.filename);
  const type = (meta.contentType ?? "").toLowerCase();
  const typeOk = (COVER_CONTENT_TYPES as readonly string[]).includes(type);
  if (!typeOk && !COVER_EXTS.has(ext))
    return { ok: false, error: "Cover must be a JPG, PNG or WebP image." };
  if (type && type.startsWith("image/") && !typeOk)
    return { ok: false, error: "Cover must be a JPG, PNG or WebP image." };
  if (!Number.isFinite(meta.sizeBytes) || meta.sizeBytes <= 0)
    return { ok: false, error: "That cover image looks empty." };
  if (meta.sizeBytes > MAX_COVER_BYTES)
    return { ok: false, error: `Cover is over the ${Math.round(MAX_COVER_BYTES / 1024 / 1024)} MB limit.` };
  return { ok: true };
}

/** Server-side gate for a generate-token request pathname. */
export function validateQueueBlobPathname(pathname: string): { ok: true; kind: "mp3" | "cover" } | { ok: false; error: string } {
  const m = /^queue\/([0-9a-f-]{36})(-cover)?\.(mp3|jpg|png|webp)$/i.exec(pathname);
  if (!m || !isQueueId(m[1])) return { ok: false, error: "Invalid queue pathname." };
  const isCover = Boolean(m[2]);
  if (!isCover && m[3].toLowerCase() !== "mp3") return { ok: false, error: "Invalid queue pathname." };
  if (isCover && m[3].toLowerCase() === "mp3") return { ok: false, error: "Invalid queue pathname." };
  return { ok: true, kind: isCover ? "cover" : "mp3" };
}

export type QueueItemInput = {
  id: unknown;
  titleOverride?: unknown;
  notes?: unknown;
  originalFilename: unknown;
  mp3Pathname: unknown;
  mp3Url?: unknown;
  mp3SizeBytes?: unknown;
  coverPathname?: unknown;
  coverUrl?: unknown;
  coverSizeBytes?: unknown;
  durationSeconds?: unknown;
};

export type QueueRecord = {
  id: string;
  title: string;
  originalFilename: string;
  mp3BlobPathname: string;
  mp3BlobUrl: string | null;
  mp3SizeBytes: number | null;
  coverBlobPathname: string | null;
  coverBlobUrl: string | null;
  coverSizeBytes: number | null;
  durationSeconds: number | null;
  notes: string | null;
  status: QueueStatus;
  uploadedBy: string;
};

/**
 * Build + validate the DB record shape from client-supplied upload results.
 * Throws Error with a user-safe message on any invalid field. Blob pathnames
 * must be exactly the unguessable queue/<id> paths — arbitrary URLs/paths a
 * client invents are rejected, so a record can never point at masters/ or
 * streams/ or an external URL as its pathname.
 */
export function buildQueueRecord(input: QueueItemInput, uploadedBy: string): QueueRecord {
  if (!isQueueId(input.id)) throw new Error("Invalid queue id.");
  const id = input.id;
  const originalFilename =
    typeof input.originalFilename === "string" ? input.originalFilename.trim() : "";
  if (!originalFilename || originalFilename.length > MAX_FILENAME_LENGTH)
    throw new Error("Original filename is required.");
  if (extensionOf(originalFilename) !== "mp3") throw new Error("Choose an .mp3 file.");
  if (!isQueueBlobPath(input.mp3Pathname, "mp3", id))
    throw new Error("Invalid MP3 blob pathname.");
  let coverPathname: string | null = null;
  if (input.coverPathname != null && input.coverPathname !== "") {
    if (!isQueueBlobPath(input.coverPathname, "cover", id))
      throw new Error("Invalid cover blob pathname.");
    coverPathname = input.coverPathname as string;
  }
  const size = (v: unknown, max: number): number | null => {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new Error("Invalid file size.");
    return Math.round(n);
  };
  const mp3SizeBytes = size(input.mp3SizeBytes, MAX_MP3_BYTES);
  let durationSeconds: number | null = null;
  if (input.durationSeconds != null) {
    const n = Number(input.durationSeconds);
    if (Number.isFinite(n) && n > 0 && n < 24 * 3600) durationSeconds = Math.round(n * 10) / 10;
  }
  const url = (v: unknown): string | null =>
    typeof v === "string" && v.startsWith("https://") && v.length <= 2048 ? v : null;
  return {
    id,
    title: cleanTitleOverride(input.titleOverride) ?? titleFromFilename(originalFilename),
    originalFilename,
    mp3BlobPathname: input.mp3Pathname as string,
    mp3BlobUrl: url(input.mp3Url),
    mp3SizeBytes,
    coverBlobPathname: coverPathname,
    coverBlobUrl: coverPathname ? url(input.coverUrl) : null,
    coverSizeBytes: coverPathname ? size(input.coverSizeBytes, MAX_COVER_BYTES) : null,
    durationSeconds,
    notes: cleanNotes(input.notes),
    status: "waiting",
    uploadedBy,
  };
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
