-- Live visitor count + all-time total.
-- One row per anonymous browser id (random, from localStorage). No IPs, no
-- personal data. last_seen drives "listening now" (heartbeat in the last ~2
-- min); counted_at is when this browser last added to the total (once per
-- ~24h). Rows older than ~26h are pruned by the heartbeat.
create table if not exists site_presence (
  visitor_id text primary key,
  last_seen timestamptz not null default now(),
  counted_at timestamptz not null default now()
);

create index if not exists site_presence_last_seen_idx
  on site_presence (last_seen);

-- Single-row all-time total. Survives deploys (lives in Postgres, not memory).
create table if not exists site_visitor_total (
  id smallint primary key default 1 check (id = 1),
  total bigint not null default 0
);

insert into site_visitor_total (id, total)
values (1, 0)
on conflict (id) do nothing;
