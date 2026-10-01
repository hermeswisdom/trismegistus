import { useState, type MouseEvent } from "react";
import { Download } from "lucide-react";
import { startMasterCheckout } from "@/lib/master-checkout";
import {
  MASTER_LICENSE_LINE,
  displayMasterPricePence,
  masterBuyCardLabel,
  masterBuyLabel,
  trackIsForSale,
} from "@/lib/masters";
import type { Track } from "@/lib/rooms";
import { cn } from "@/lib/utils";

export function BuyMasterButton({
  track,
  variant = "hero",
  className,
}: {
  track: Track;
  variant?: "hero" | "card";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!trackIsForSale(track)) return null;
  const price = displayMasterPricePence();
  const label =
    variant === "card" ? masterBuyCardLabel(price) : masterBuyLabel(price);

  async function begin(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await startMasterCheckout({ data: { trackId: track.id } });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
    }
  }

  if (variant === "card") {
    return (
      <div className={cn("flex flex-col items-start", className)}>
        <button
          type="button"
          data-buy-master={track.id}
          onClick={begin}
          disabled={busy}
          className="inline-flex h-7 w-full max-w-full items-center gap-1 bg-accent px-2 text-[0.58rem] font-medium tracking-[0.12em] text-bg uppercase transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-60 sm:h-8 sm:w-auto sm:px-2.5 sm:text-[0.62rem]"
        >
          <Download className="size-3 shrink-0" />
          <span className="truncate">{busy ? "Opening…" : label}</span>
        </button>
        {error ? (
          <span className="mt-1 max-w-[11rem] text-[0.6rem] leading-snug text-accent">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        data-buy-master={track.id}
        onClick={begin}
        disabled={busy}
        className="inline-flex h-12 w-fit touch-manipulation items-center gap-2 bg-elevated px-5 text-xs font-medium tracking-[0.2em] text-fg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] disabled:opacity-60"
      >
        <Download className="size-3.5" />
        {busy ? "Opening checkout" : label}
      </button>
      <span className="text-[0.65rem] tracking-[0.16em] text-subtle uppercase">
        {MASTER_LICENSE_LINE}
      </span>
      {error ? <span className="max-w-xs text-xs text-accent">{error}</span> : null}
    </div>
  );
}
