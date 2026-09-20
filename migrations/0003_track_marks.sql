create table if not exists track_marks (
  id serial primary key,
  track_id text not null,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists track_marks_track_idx
  on track_marks (track_id, created_at desc);
