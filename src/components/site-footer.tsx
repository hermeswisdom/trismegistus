import { SOUNDCLOUD_PROFILE, TRACKS } from "@/lib/rooms";

export function SiteFooter() {
  return (
    <footer className="border-t border-border pb-36">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="font-display text-xl tracking-[0.16em] text-fg uppercase sm:text-2xl">
            Atman Music
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Esoteric music. {TRACKS.length} covers. Esoteric Vibrations.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <a
            href={SOUNDCLOUD_PROFILE}
            target="_blank"
            rel="noreferrer"
            className="text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent"
          >
            SoundCloud · esoteric_vibrations
          </a>
          <a
            href="https://x.com/Hermes10wisdom"
            target="_blank"
            rel="noreferrer"
            className="text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent"
          >
            X · Hermes10wisdom
          </a>
        </div>
      </div>
    </footer>
  );
}
