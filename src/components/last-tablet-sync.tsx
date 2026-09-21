import { useEffect, useLayoutEffect } from "react";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { focusedTrackFromSearch } from "@/lib/daily-catalog";
import { isSignedInForSaves } from "@/lib/favorites-sync";
import { readLastTablet, writeLastTablet } from "@/lib/last-tablet";
import { loadMyLastTablet, saveMyLastTablet } from "@/lib/prefs";
import { usePlayer } from "@/lib/player-store";
import { getTrack } from "@/lib/rooms";

type HomeSearch = { daily?: 1; tablet?: string };

export function LastTabletSync({ search }: { search: HomeSearch }) {
  const currentId = usePlayer((s) => s.currentId);
  const entered = usePlayer((s) => s.entered);
  const { user, isPending } = useCurrentUserState();
  const signedIn = isSignedInForSaves({
    authEnabled,
    userId: user?.id,
    isDevFallback: user?.isDevFallback,
  });

  useLayoutEffect(() => {
    const focus = focusedTrackFromSearch(search);
    if (focus.source !== "none") {
      usePlayer.setState({ currentId: focus.trackId });
      return;
    }
    const last = readLastTablet();
    if (last && getTrack(last)) {
      usePlayer.setState({ currentId: last });
    }
  }, [search]);

  useEffect(() => {
    if (!signedIn || isPending) return;
    const focus = focusedTrackFromSearch(search);
    if (focus.source !== "none") return;
    let cancelled = false;
    void loadMyLastTablet()
      .then((payload) => {
        if (cancelled || !payload?.trackId || !getTrack(payload.trackId)) return;
        writeLastTablet(payload.trackId);
        if (!usePlayer.getState().entered) {
          usePlayer.setState({ currentId: payload.trackId });
        }
      })
      .catch(() => {
        /* local last tablet still holds */
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, isPending, search]);

  useEffect(() => {
    if (!entered) return;
    writeLastTablet(currentId);
    if (!signedIn) return;
    void saveMyLastTablet({ data: currentId }).catch(() => {
      /* local last tablet still holds */
    });
  }, [currentId, entered, signedIn]);

  return null;
}
