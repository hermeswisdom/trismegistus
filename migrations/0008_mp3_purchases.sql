-- Paid raw-master MP3 receipts. Session id is the Stripe Checkout id
-- (or a dry_<trackId>_<nonce> preview id). Auth stays off for v1.

create table if not exists mp3_purchases (
  session_id text primary key,
  track_id text not null,
  download_key text not null,
  email text,
  receipt_token text not null,
  download_count integer not null default 0,
  max_downloads integer not null default 8,
  paid_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_download_at timestamptz
);

create unique index if not exists mp3_purchases_receipt_idx
  on mp3_purchases (receipt_token);

create index if not exists mp3_purchases_track_idx
  on mp3_purchases (track_id, paid_at desc);
