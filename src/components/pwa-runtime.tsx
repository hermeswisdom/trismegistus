import { useEffect } from "react";
import { InstallNudge } from "@/components/install-nudge";

export function PwaRuntime() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* installability still works from the manifest on current Chrome */
    });
  }, []);

  return <InstallNudge />;
}
