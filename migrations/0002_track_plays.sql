create table if not exists track_plays (
  track_id text primary key,
  plays integer not null default 0,
  last_played_at timestamptz not null default now()
);

create index if not exists track_plays_plays_idx on track_plays (plays desc);
