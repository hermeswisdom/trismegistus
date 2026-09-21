-- Signed-in favorites and last-played tablet. Anonymous visitors keep both in
-- localStorage. user_id is TEXT (Better Auth ids, plus the preview 'dev-user').

create table if not exists user_favorites (
  user_id text not null,
  track_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create index if not exists user_favorites_user_idx
  on user_favorites (user_id, created_at desc);

create table if not exists user_prefs (
  user_id text primary key,
  last_track_id text,
  updated_at timestamptz not null default now()
);
