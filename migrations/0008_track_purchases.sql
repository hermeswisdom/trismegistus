create table if not exists track_purchases (
  session_id text primary key,
  track_id text not null,
  download_key text not null,
  email text,
  token text not null,
  expires_at timestamptz not null,
  uses_remaining integer not null default 6,
  dry_run boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists track_purchases_token_idx on track_purchases (token);
create index if not exists track_purchases_track_idx on track_purchases (track_id);
