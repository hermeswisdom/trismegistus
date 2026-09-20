import { createServerFn } from "@tanstack/react-start";
import { TRACKS } from "@/lib/rooms";

export type PlayRow = {
  trackId: string;
  plays: number;
};

const KNOWN = new Set(TRACKS.map((track) => track.id));

async function readBoard(): Promise<PlayRow[]> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ trackId: string; plays: number }>`
      select track_id as "trackId", plays
      from track_plays
      order by plays desc, last_played_at desc
      limit 10
    `;
    return rows.filter((row) => KNOWN.has(row.trackId));
  } catch {
    return [];
  }
}

export const getPlayLeaderboard = createServerFn({ method: "GET" }).handler(
  async () => readBoard(),
);

export const recordPlay = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    if (!KNOWN.has(id)) return readBoard();
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        insert into track_plays (track_id, plays, last_played_at)
        values (${id}, 1, now())
        on conflict (track_id) do update
          set plays = track_plays.plays + 1,
              last_played_at = now()
      `;
    } catch {
      /* preview without a live DB still serves the page */
    }
    return readBoard();
  });
