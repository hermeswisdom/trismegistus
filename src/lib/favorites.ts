import { createServerFn } from "@tanstack/react-start";
import { optionalSessionMiddleware } from "@/lib/auth/middleware";
import { mergeFavoriteIds } from "@/lib/favorites-sync";
import { TRACKS } from "@/lib/rooms";

const KNOWN = new Set(TRACKS.map((track) => track.id));

export type FavoritesPayload = {
  ids: string[];
  signedIn: boolean;
};

async function readFavoriteIds(userId: string): Promise<string[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ trackId: string }>`
    select track_id as "trackId"
    from user_favorites
    where user_id = ${userId}
    order by created_at desc
  `;
  return rows.map((row) => row.trackId).filter((id) => KNOWN.has(id));
}

export const listMyFavorites = createServerFn({ method: "GET" })
  .middleware([optionalSessionMiddleware])
  .handler(async ({ context }): Promise<FavoritesPayload> => {
    const user = context.sessionUser;
    if (!user) return { ids: [], signedIn: false };
    try {
      return { ids: await readFavoriteIds(user.id), signedIn: true };
    } catch {
      return { ids: [], signedIn: true };
    }
  });

export const syncMyFavorites = createServerFn({ method: "POST" })
  .middleware([optionalSessionMiddleware])
  .validator((ids: string[]) =>
    ids
      .filter((id): id is string => typeof id === "string" && KNOWN.has(id))
      .slice(0, TRACKS.length),
  )
  .handler(async ({ data, context }): Promise<FavoritesPayload> => {
    const user = context.sessionUser;
    if (!user) return { ids: data, signedIn: false };
    try {
      const remote = await readFavoriteIds(user.id);
      const merged = mergeFavoriteIds(data, remote, KNOWN);
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      for (const id of merged) {
        await sql`
          insert into user_favorites (user_id, track_id)
          values (${user.id}, ${id})
          on conflict (user_id, track_id) do nothing
        `;
      }
      return { ids: merged, signedIn: true };
    } catch {
      return { ids: data, signedIn: true };
    }
  });

export const setMyFavorite = createServerFn({ method: "POST" })
  .middleware([optionalSessionMiddleware])
  .validator((input: { trackId: string; liked: boolean }) => ({
    trackId: typeof input.trackId === "string" ? input.trackId : "",
    liked: Boolean(input.liked),
  }))
  .handler(async ({ data, context }): Promise<FavoritesPayload> => {
    const user = context.sessionUser;
    if (!user) return { ids: [], signedIn: false };
    if (!KNOWN.has(data.trackId)) {
      try {
        return { ids: await readFavoriteIds(user.id), signedIn: true };
      } catch {
        return { ids: [], signedIn: true };
      }
    }
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      if (data.liked) {
        await sql`
          insert into user_favorites (user_id, track_id)
          values (${user.id}, ${data.trackId})
          on conflict (user_id, track_id) do nothing
        `;
      } else {
        await sql`
          delete from user_favorites
          where user_id = ${user.id} and track_id = ${data.trackId}
        `;
      }
      return { ids: await readFavoriteIds(user.id), signedIn: true };
    } catch {
      return { ids: [], signedIn: true };
    }
  });
