import { useEffect } from "react";
import { registerOfflineWorker } from "@/lib/offline-runtime";
import { useOfflineSaves } from "@/lib/offline-store";

/** Hydrate IndexedDB saves and register the scoped offline worker. */
export function OfflineRuntime() {
  const hydrate = useOfflineSaves((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void registerOfflineWorker();
  }, [hydrate]);

  return null;
}
