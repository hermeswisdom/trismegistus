import type { MouseEvent } from "react";
import { Check, HardDriveDownload, LoaderCircle, X } from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";
import { saveErrorCopy, saveOfflineGate } from "@/lib/offline-library";
import { useOfflineSaves } from "@/lib/offline-store";
import type { Track } from "@/lib/rooms";
import { cn } from "@/lib/utils";

export function SaveOfflineButton({
  track,
  variant = "hero",
  className,
}: {
  track: Track;
  variant?: "hero" | "card" | "sheet";
  className?: string;
}) {
  const hydrated = useHydrated();
  const ready = useOfflineSaves((s) => s.ready);
  const supported = useOfflineSaves((s) => s.supported);
  const status = useOfflineSaves((s) => s.statusBySlug[track.slug]);
  const save = useOfflineSaves((s) => s.save);
  const cancel = useOfflineSaves((s) => s.cancel);
  const remove = useOfflineSaves((s) => s.remove);

  const gate = saveOfflineGate(track.slug, !(hydrated && ready) || supported);
  const unavailable = hydrated && ready && gate !== "ready";
  const state = hydrated && ready ? (status?.state ?? "idle") : "idle";
  const saving = state === "saving";
  const saved = state === "saved";
  const errored = state === "error";
  const percent =
    saving && status?.total && status.total > 0 && typeof status.received === "number"
      ? Math.min(99, Math.round((status.received / status.total) * 100))
      : null;

  let label = variant === "card" ? "Save" : "Save offline";
  if (unavailable && gate === "no-stream") label = variant === "card" ? "No stream" : "No stream to save";
  else if (unavailable && gate === "unsupported") label = variant === "card" ? "Can't save" : "Can't save offline";
  else if (saving) label = percent == null ? "Saving…" : `Saving ${percent}%`;
  else if (saved) label = "Saved";
  else if (errored) label = "Try again";

  const hint =
    unavailable && gate === "unsupported"
      ? saveErrorCopy("unsupported")
      : unavailable && gate === "no-stream"
        ? saveErrorCopy("no-stream")
        : errored && status?.error
          ? status.error
          : variant === "hero"
            ? "Listening copy · 128 kbps"
            : variant === "sheet"
              ? "Listening copy · 128 kbps · not the £0.99 master"
              : null;

  function onActivate(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (unavailable) return;
    if (saving) {
      cancel(track.slug);
      return;
    }
    if (saved) {
      void remove(track.slug);
      return;
    }
    void save(track);
  }

  const compact = variant === "card";

  return (
    <div className={cn("flex flex-col items-start", compact ? "w-full" : "gap-1", className)}>
      <button
        type="button"
        data-save-offline={track.slug}
        data-save-state={unavailable ? "unavailable" : state}
        data-save-variant={variant}
        aria-label={
          saved ? `Remove ${track.title} listening copy from this device` : `Save ${track.title} offline`
        }
        aria-pressed={saved || undefined}
        aria-busy={saving || undefined}
        title={hint ?? undefined}
        disabled={unavailable}
        onClick={onActivate}
        className={cn(
          "inline-flex touch-manipulation items-center font-medium uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] disabled:opacity-60",
          compact
            ? "h-7 w-full max-w-full gap-1 bg-elevated px-2 text-[0.58rem] tracking-[0.12em] text-fg sm:h-8 sm:px-2.5 sm:text-[0.62rem]"
            : "h-12 w-fit gap-2 bg-elevated px-5 text-xs tracking-[0.2em] text-fg",
        )}
      >
        {saving ? (
          <LoaderCircle className={cn("shrink-0 animate-spin", compact ? "size-3" : "size-3.5")} />
        ) : saved ? (
          <Check className={cn("shrink-0 text-accent", compact ? "size-3" : "size-3.5")} />
        ) : errored || unavailable ? (
          <X className={cn("shrink-0", compact ? "size-3" : "size-3.5")} />
        ) : (
          <HardDriveDownload className={cn("shrink-0", compact ? "size-3" : "size-3.5")} />
        )}
        <span className="truncate">{label}</span>
      </button>
      {hint && variant !== "card" ? (
        <span
          className={cn(
            "max-w-xs text-[0.65rem] tracking-[0.16em] uppercase",
            errored || unavailable ? "text-accent" : "text-subtle",
          )}
          data-save-error={errored || unavailable ? track.slug : undefined}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
