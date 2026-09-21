import { createServerFn } from "@tanstack/react-start";
import { optionalSessionMiddleware } from "@/lib/auth/middleware";
import { parseLastTablet } from "@/lib/last-tablet";
import { TRACKS } from "@/lib/rooms";

const KNOWN = new Set(TRACKS.map((track) => track.id));

export type LastTabletPayload = {
  trackId: string | null;
  signedIn: boolean;
};

export const loadMyLastTablet = createServerFn({ method: "GET" })
  .middleware([optionalSessionMiddleware])
  .handler(async ({ context }): Promise<LastTabletPayload> => {
    const user = context.sessionUser;
    if (!user) return { trackId: null, signedIn: false };
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const rows = await sql<{ trackId: string | null }>`
        select last_track_id as "trackId"
        from user_prefs
        where user_id = ${user.id}
      `;
      return {
        trackId: parseLastTablet(rows[0]?.trackId ?? null, KNOWN),
        signedIn: true,
      };
    } catch {
      return { trackId: null, signedIn: true };
    }
  });

export const saveMyLastTablet = createServerFn({ method: "POST" })
  .middleware([optionalSessionMiddleware])
  .validator((trackId: string) => parseLastTablet(trackId, KNOWN))
  .handler(async ({ data, context }): Promise<LastTabletPayload> => {
    const user = context.sessionUser;
    if (!user || !data) return { trackId: data, signedIn: Boolean(user) };
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        insert into user_prefs (user_id, last_track_id, updated_at)
        values (${user.id}, ${data}, now())
        on conflict (user_id) do update
          set last_track_id = excluded.last_track_id,
              updated_at = now()
      `;
      return { trackId: data, signedIn: true };
    } catch {
      return { trackId: data, signedIn: true };
    }
  });
