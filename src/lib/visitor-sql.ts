// Relative import so node --test (strip-types) can load this without the @ alias.
import {
  COUNT_WINDOW_HOURS,
  ONLINE_WINDOW_SECONDS,
  PRUNE_AFTER_HOURS,
} from "./visitor-count.ts";

/**
 * One round trip per heartbeat: upsert this browser's presence row, bump the
 * all-time total if the browser was not counted in the last ~24h, and read
 * both counts back. Data-modifying CTEs see the pre-statement snapshot, so the
 * live count excludes this id and adds it back (+1), and the total prefers the
 * bumped value.
 */
export const HEARTBEAT_SQL = `
  with up as (
    insert into site_presence as p (visitor_id, last_seen, counted_at)
    values ($1, now(), now())
    on conflict (visitor_id) do update
      set last_seen = now(),
          counted_at = case
            when p.counted_at <= now() - interval '${COUNT_WINDOW_HOURS} hours' then now()
            else p.counted_at
          end
    returning (p.counted_at = now()) as counted
  ),
  bump as (
    update site_visitor_total
      set total = total + 1
      where id = 1 and exists (select 1 from up where counted)
      returning total
  )
  select
    coalesce(
      (select total from bump),
      (select total from site_visitor_total where id = 1)
    ) as total,
    (
      select count(*) from site_presence
      where last_seen > now() - interval '${ONLINE_WINDOW_SECONDS} seconds'
        and visitor_id <> $1
    ) + 1 as online
`;

/** Read-only counts for bots / invalid ids — they never write a row. */
export const READ_SQL = `
  select
    (select total from site_visitor_total where id = 1) as total,
    (
      select count(*) from site_presence
      where last_seen > now() - interval '${ONLINE_WINDOW_SECONDS} seconds'
    ) as online
`;

export const PRUNE_SQL = `
  delete from site_presence
  where last_seen < now() - interval '${PRUNE_AFTER_HOURS} hours'
`;
