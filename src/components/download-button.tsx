import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  buyLabel,
  displayDownloadPriceGbp,
  DOWNLOAD_LEGAL,
  formatGbp,
  getDownloadStorefront,
  startDownloadCheckout,
  trackHasMaster,
} from "@/lib/downloads";
import type { Track } from "@/lib/rooms";
import { cn } from "@/lib/utils";

export function DownloadMp3Button({
  track,
  variant = "hero",
  className,
}: {
  track: Track;
  variant?: "hero" | "card";
  className?: string;
}) {
  const [price, setPrice] = useState(displayDownloadPriceGbp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getDownloadStorefront()
      .then((store) => setPrice(store.priceGbp))
      .catch(() => {
        /* keep the client default */
      });
  }, []);

  if (!trackHasMaster(track)) return null;

  const label =
    variant === "card"
      ? `MP3 · ${formatGbp(price)}`
      : (buyLabel(track, price) ?? `Download MP3 · ${formatGbp(price)}`);

  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <button
        type="button"
        data-download-track={track.id}
        aria-label={`${label}. ${DOWNLOAD_LEGAL}`}
        disabled={busy}
        onClick={async (event) => {
          event.stopPropagation();
          event.preventDefault();
          setError(null);
          setBusy(true);
          try {
            const result = await startDownloadCheckout({
              data: { trackId: track.id },
            });
            if (result.ok && result.url) {
              window.location.assign(result.url);
              return;
            }
            setError(result.ok ? "Checkout did not return a URL." : result.message);
          } catch {
            setError("Checkout failed. Try again.");
          } finally {
            setBusy(false);
          }
        }}
        className={cn(
          "inline-flex w-fit touch-manipulation items-center gap-2 font-medium uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] disabled:opacity-60",
          variant === "hero"
            ? "h-12 bg-accent px-5 text-xs tracking-[0.2em] text-bg"
            : "h-7 bg-accent px-2 text-[0.6rem] tracking-[0.14em] text-bg sm:h-8 sm:px-2.5",
        )}
      >
        <Download className={variant === "hero" ? "size-3.5" : "size-3"} />
        {busy ? "Opening…" : label}
      </button>
      {error ? (
        <span className="mt-1 max-w-[12rem] text-[0.65rem] leading-snug text-muted">
          {error}
        </span>
      ) : null}
    </span>
  );
}
