import { useEffect } from "react";
import { registerMediaSessionActions } from "@/lib/media-session";
import { claimPlaybackAudioSession } from "@/lib/native-audio";
import { registerOfflineWorker } from "@/lib/offline-runtime";
import { requestPersistentStorage } from "@/lib/offline-library";
import { useOfflineSaves } from "@/lib/offline-store";

/** Hydrate IndexedDB / Cache Storage saves and register the scoped offline worker. */
export function OfflineRuntime() {
  const hydrate = useOfflineSaves((s) => s.hydrate);

  useEffect(() => {
    void requestPersistentStorage();
    void hydrate();
    void registerOfflineWorker();
    const onShow = () => {
      // Safari 7-day ITP and iOS IDB blob loss show up after a freeze/reopen.
      // Re-read storage so a vanished copy looks not-saved, not broken.
      void hydrate({ force: true });
      claimPlaybackAudioSession();
      registerMediaSessionActions();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [hydrate]);

  return null;
}
