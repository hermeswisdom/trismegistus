import { useLayoutEffect } from "react";
import { applyPhoneViewport } from "@/lib/viewport-lock";

export function ViewportLock() {
  useLayoutEffect(() => {
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
