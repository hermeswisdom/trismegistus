import { createServerFn } from "@tanstack/react-start";
import { TRACKS } from "@/lib/rooms";

export type TrackMark = {
  id: number;
  trackId: string;
  author: string;
  body: string;
  createdAt: string;
  userId?: string | null;
};

const KNOWN = new Set(TRACKS.map((track) => track.id));

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

async function readMarks(trackId: string): Promise<TrackMark[]> {
  if (!KNOWN.has(trackId)) return [];
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      trackId: string;
      author: string;
      body: string;
      createdAt: string;
      userId: string | null;
    }>`
      select
        id,
        track_id as "trackId",
        author,
        body,
        created_at::text as "createdAt",
        user_id as "userId"
      from track_marks
      where track_id = ${trackId}
      order by created_at desc
      limit 40
    `;
    return rows;
  } catch {
    return [];
  }
}

async function readAllMarks(): Promise<TrackMark[]> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      trackId: string;
      author: string;
      body: string;
      createdAt: string;
      userId: string | null;
    }>`
      select
        id,
        track_id as "trackId",
        author,
        body,
        created_at::text as "createdAt",
        user_id as "userId"
      from track_marks
      order by created_at desc
      limit 400
    `;
    return rows.filter((row) => KNOWN.has(row.trackId));
  } catch {
    return [];
  }
}

export const listTrackMarks = createServerFn({ method: "POST" })
  .validator((trackId: string) => trackId)
  .handler(async ({ data: trackId }) => readMarks(trackId));

export const listAllTrackMarks = createServerFn({ method: "GET" }).handler(
  async () => readAllMarks(),
);

export const addTrackMark = createServerFn({ method: "POST" })
  .validator((input: { trackId: string; author: string; body: string }) => ({
    trackId: input.trackId,
    author: clean(input.author, 40),
    body: clean(input.body, 280),
  }))
  .handler(async ({ data }) => {
    if (!KNOWN.has(data.trackId) || !data.author || !data.body) {
      return readMarks(data.trackId);
    }
    let userId: string | null = null;
    let author = data.author;
    try {
      const { getSessionUser } = await import("@/lib/auth/verify.server");
      const session = await getSessionUser();
      if (session?.id) {
        userId = session.id;
        const named = session.email?.split("@")[0];
        if (named && !author) author = clean(named, 40);
      }
    } catch {
      /* anonymous marks still land */
    }
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        insert into track_marks (track_id, author, body, user_id)
        values (${data.trackId}, ${author}, ${data.body}, ${userId})
      `;
    } catch {
      /* page still serves if the store is down */
    }
    return readMarks(data.trackId);
  });
