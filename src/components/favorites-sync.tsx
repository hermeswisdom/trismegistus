import { useEffect, useRef } from "react";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyFavorites, syncMyFavorites } from "@/lib/favorites";
import { idsFromHeartMap, isSignedInForSaves, mergeFavoriteIds } from "@/lib/favorites-sync";
import { useHearts } from "@/lib/hearts";

/** Hydrate local hearts, then merge Neon favorites once a real session is on. */
export function FavoritesSync() {
  const hydrate = useHearts((s) => s.hydrate);
  const replace = useHearts((s) => s.replace);
  const { user, isPending } = useCurrentUserState();
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isSignedInForSaves({
      authEnabled,
      userId: user?.id,
      isDevFallback: user?.isDevFallback,
    })) {
      mergedFor.current = null;
      return;
    }
    if (isPending || !user) return;
    if (mergedFor.current === user.id) return;
    mergedFor.current = user.id;
    const local = idsFromHeartMap(useHearts.getState().ids);
    void (async () => {
      try {
        const remote = await listMyFavorites();
        if (!remote?.signedIn) return;
        const merged = mergeFavoriteIds(local, remote.ids);
        replace(merged);
        if (local.length > 0) {
          const saved = await syncMyFavorites({ data: local });
          if (saved?.ids) replace(saved.ids);
        }
      } catch {
        /* local hearts still hold */
      }
    })();
  }, [user, isPending, replace]);

  return null;
}
