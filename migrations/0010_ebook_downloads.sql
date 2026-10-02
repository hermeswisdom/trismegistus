-- Free ebook download counter: one row per format ("pdf" / "epub").
-- Production only, never QC traffic (src/routes/api/ebook/hit.ts). No IPs, no
-- visitor ids, nothing personal.
create table if not exists ebook_downloads (
  format text primary key,
  downloads integer not null default 0,
  last_download_at timestamptz not null default now()
);
