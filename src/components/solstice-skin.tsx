import { useLayoutEffect } from "react";
import { applySolsticeSkin } from "@/lib/solstice-skin";

/**
 * Re-applies `html[data-skin]` after hydrate. The head boot script already
 * set it for first paint; this restores it if React patched the html node.
 * Renders nothing — the look is CSS only.
 */
export function SolsticeSkin() {
  useLayoutEffect(() => {
    applySolsticeSkin();
  }, []);
  return null;
}
