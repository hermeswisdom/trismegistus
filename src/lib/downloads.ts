import { createServerFn } from "@tanstack/react-start";
import {
  displayDownloadPriceGbp,
  formatGbp,
  trackHasMaster,
} from "@/lib/downloads-core";
import type { Track } from "@/lib/rooms";

export {
  DEFAULT_DOWNLOAD_PRICE_GBP,
  DEFAULT_DOWNLOAD_MAX_USES,
  DEFAULT_DOWNLOAD_TTL_HOURS,
  displayDownloadPriceGbp,
  DOWNLOAD_LEGAL,
  formatGbp,
  getSellableTrack,
  masterBlobPath,
  parsePriceGbp,
  parsePriceIdMap,
  priceToPence,
  trackHasMaster,
} from "@/lib/downloads-core";

export type {
  CheckoutStart,
  DownloadGrantResult,
  DownloadGrantView,
  Storefront,
} from "@/lib/downloads-core";

export function buyLabel(track: Track, priceGbp = displayDownloadPriceGbp()) {
  if (!trackHasMaster(track)) return null;
  return `Download MP3 · ${formatGbp(priceGbp)}`;
}

export const getDownloadStorefront = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getStorefront } = await import("@/lib/downloads.server");
    return getStorefront();
  },
);

export const startDownloadCheckout = createServerFn({ method: "POST" })
  .validator((input: { trackId: string }) => ({
    trackId: typeof input.trackId === "string" ? input.trackId.trim() : "",
  }))
  .handler(async ({ data }) => {
    const { createCheckout } = await import("@/lib/downloads.server");
    return createCheckout(data.trackId);
  });

export const loadDownloadGrant = createServerFn({ method: "GET" })
  .validator((input: { sessionId?: string; token?: string }) => ({
    sessionId:
      typeof input.sessionId === "string" ? input.sessionId.trim() : undefined,
    token: typeof input.token === "string" ? input.token.trim() : undefined,
  }))
  .handler(async ({ data }) => {
    const { loadGrant } = await import("@/lib/downloads.server");
    return loadGrant(data);
  });
