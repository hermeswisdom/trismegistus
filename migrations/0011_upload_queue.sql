-- Phase 1 admin upload queue (see src/lib/upload-queue.ts).
-- Items land here + in private Blob under queue/ and are NEVER part of the
-- public wall catalogue. An agent later moves status waiting -> in_progress
-- -> live/rejected by hand; publishing to the wall is a separate step.
-- Idempotent (IF NOT EXISTS throughout): safe to re-run, and applied by the
-- existing pipeline (scripts/migrate.mjs on Vercel build / PGLite on boot)
-- exactly like 0009/0010. Do not run by hand against production.
create table if not exists upload_queue (
  id uuid primary key,
  title text not null,
  original_filename text not null,
  mp3_blob_pathname text not null unique,
  mp3_blob_url text,
  mp3_size_bytes bigint,
  cover_blob_pathname text unique,
  cover_blob_url text,
  cover_size_bytes bigint,
  duration_seconds double precision,
  notes text,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_progress', 'live', 'rejected')),
  uploaded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists upload_queue_status_created_idx
  on upload_queue (status, created_at desc);
