create table if not exists signals (
  id serial primary key,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists signals_created_idx
  on signals (created_at desc);
