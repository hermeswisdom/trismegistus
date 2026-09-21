create table if not exists listen_marks (
  id serial primary key,
  track_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists listen_marks_created_idx
  on listen_marks (created_at desc);

create index if not exists listen_marks_track_idx
  on listen_marks (track_id);

create table if not exists listen_mark_limits (
  visitor_hash text primary key,
  window_start timestamptz not null,
  mark_count integer not null default 0,
  last_mark_at timestamptz not null
);
