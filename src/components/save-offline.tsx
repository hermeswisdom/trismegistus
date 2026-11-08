import { Check, HardDriveDownload, LoaderCircle, X } from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";
import { hasStream } from "@/lib/streams";
import { useOfflineSaves } from "@/lib/offline-store";
import type { Track } from "@/lib/rooms";
import { cn } from "@/lib/utils";

export function SaveOfflineButton({
  track,
  className,
}: {
  track: Track;
  className?: string;
}) {
  const hydrated = useHydrated();
  const ready = useOfflineSaves((s) => s.ready);
  const supported = useOfflineSaves((s) => s.supported);
  const status = useOfflineSaves((s) => s.statusBySlug[track.slug]);
  const save = useOfflineSaves((s) => s.save);
  const cancel = useOfflineSaves((s) => s.cancel);
  const remove = useOfflineSaves((s) => s.remove);

  if (!hasStream(track.slug)) return null;

  const state = hydrated && ready ? (status?.state ?? "idle") : "idle";
  const saving = state === "saving";
  const saved = state === "saved";
  const errored = state === "error";
  const percent =
    saving && status?.total && status.total > 0 && typeof status.received === "number"
      ? Math.min(99, Math.round((status.received / status.total) * 100))
      : null;

  let label = "Save offline";
  if (saving) label = percent == null ? "Saving…" : `Saving ${percent}%`;
  else if (saved) label = "Saved";
  else if (errored) label = "Try again";

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        data-save-offline={track.slug}
        data-save-state={state}
        aria-pressed={saved || undefined}
        aria-busy={saving || undefined}
        disabled={hydrated && ready && !supported && !saved}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (saving) {
            cancel(track.slug);
            return;
          }
          if (saved) {
            void remove(track.slug);
            return;
          }
          void save(track);
        }}
        className="inline-flex h-12 w-fit touch-manipulation items-center gap-2 bg-elevated px-5 text-xs font-medium tracking-[0.2em] text-fg uppercase transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.96] disabled:opacity-60"
      >
        {saving ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : saved ? (
          <Check className="size-3.5 text-accent" />
        ) : errored ? (
          <X className="size-3.5" />
        ) : (
          <HardDriveDownload className="size-3.5" />
        )}
        {label}
      </button>
      <span className="text-[0.65rem] tracking-[0.16em] text-subtle uppercase">
        Listening copy · 128 kbps
      </span>
      {errored && status?.error ? (
        <span className="max-w-xs text-xs text-accent" data-save-error={track.slug}>
          {status.error}
        </span>
      ) : !supported && hydrated && ready ? (
        <span className="max-w-xs text-xs text-accent">This browser can&apos;t save songs offline.</span>
      ) : null}
    </div>
  );
}
