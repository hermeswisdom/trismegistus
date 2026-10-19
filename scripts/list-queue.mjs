#!/usr/bin/env node
/**
 * Agent pickup for the Phase 1 admin upload queue.
 *
 *   node scripts/list-queue.mjs [--status waiting] [--json] [--dry-run]
 *
 * Reads upload_queue from the same Neon DB the app uses (DATABASE_URL, the
 * env already configured on Vercel / Rivet's machine — never committed).
 * Without DATABASE_URL (or with --dry-run) it prints what it *would* run and
 * exits 0, so it is safe to smoke-test anywhere. It lists only; it never
 * publishes, moves status, or touches the wall catalogue.
 *
 * Statuses: waiting (default) | in_progress | live | rejected
 */
import { fileURLToPath } from "node:url";

export const QUEUE_STATUSES = ["waiting", "in_progress", "live", "rejected"];

export const LIST_QUEUE_QUERY = `
  select id, title, original_filename, mp3_blob_pathname, mp3_blob_url,
         mp3_size_bytes, cover_blob_pathname, duration_seconds, notes,
         status, uploaded_by, created_at
  from upload_queue where status = $1
  order by created_at desc, id desc limit 200
`;

export function parseListQueueArgs(argv = []) {
  let status = "waiting";
  let json = false;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--json") json = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--status") status = argv[++i] ?? "";
    else if (a?.startsWith("--status=")) status = a.slice("--status=".length);
    else if (a === "--help" || a === "-h") return { help: true, status, json, dryRun };
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!QUEUE_STATUSES.includes(status)) {
    throw new Error(`invalid --status ${status} (one of ${QUEUE_STATUSES.join(", ")})`);
  }
  return { help: false, status, json, dryRun };
}

export function formatQueueRows(rows) {
  if (!rows.length) return "queue: nothing waiting";
  return rows
    .map((r, i) => {
      const when = r.created_at ? new Date(r.created_at).toISOString() : "?";
      const size = r.mp3_size_bytes == null ? "?" : `${(Number(r.mp3_size_bytes) / 1024 / 1024).toFixed(1)} MB`;
      const notes = r.notes ? ` — ${String(r.notes).replace(/\s+/g, " ").slice(0, 120)}` : "";
      return `${i + 1}. ${r.title} [${r.status}] ${when} · ${size}\n   file: ${r.original_filename} · blob: ${r.mp3_blob_pathname} · by ${r.uploaded_by}${notes}`;
    })
    .join("\n");
}

export function dryRunMessage(opts) {
  return [
    "[list-queue] dry run — no database queried.",
    `[list-queue] would run LIST_QUEUE_QUERY with status='${opts.status}' against DATABASE_URL.`,
    "[list-queue] set DATABASE_URL (Neon, already on Vercel) to list real waiting items.",
  ].join("\n");
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseListQueueArgs(argv);
  if (opts.help) {
    console.log("Usage: node scripts/list-queue.mjs [--status waiting] [--json] [--dry-run]");
    return { ok: true, help: true };
  }
  if (opts.dryRun || !process.env.DATABASE_URL?.trim()) {
    console.log(dryRunMessage(opts));
    return { ok: true, dryRun: true };
  }
  const { default: pg } = await import("pg");
  const url = process.env.DATABASE_URL.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=&|#|$)/i,
    "$1verify-full",
  );
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const res = await pool.query(LIST_QUEUE_QUERY, [opts.status]);
    console.log(opts.json ? JSON.stringify(res.rows, null, 2) : formatQueueRows(res.rows));
    return { ok: true, count: res.rows.length };
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(`[list-queue] ${err?.message || err}`);
    process.exit(1);
  });
}
