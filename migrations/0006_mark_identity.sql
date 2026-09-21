alter table track_marks
  add column if not exists user_id text;

create index if not exists track_marks_user_idx
  on track_marks (user_id, created_at desc);
