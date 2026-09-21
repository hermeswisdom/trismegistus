import { useEffect } from "react";
import { applyPhoneViewport } from "@/lib/viewport-lock";

export function ViewportLock() {
  useEffect(() => {
    applyPhoneViewport();
    const onResize = () => applyPhoneViewport();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);
  return null;
}
