import { InstallAppButton, InstallPrompt } from "@/components/install-app";
import { X_HANDLE, X_PROFILE } from "@/lib/artist";
import { SOUNDCLOUD_PROFILE, TRACKS } from "@/lib/rooms";

export function SiteFooter() {
  return (
    <footer className="border-t border-border pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
      <InstallPrompt className="mx-5 mt-8 max-w-xl sm:mx-8 lg:mx-auto" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="font-display text-xl tracking-[0.16em] text-fg uppercase sm:text-2xl">
            Atman Music
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted">
            The full catalog. {TRACKS.length} covers.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <a
            href={SOUNDCLOUD_PROFILE}
            target="_blank"
            rel="noreferrer"
            className="text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent"
          >
            SoundCloud
          </a>
          <a
            href={X_PROFILE}
            target="_blank"
            rel="noreferrer"
            className="text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent"
          >
            X · {X_HANDLE}
          </a>
          <a
            href="/bowls"
            className="text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent"
          >
            Sound bowls
          </a>
          <a
            href="/ebook"
            className="text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent"
          >
            Free ebook
          </a>
          <a
            href="/download"
            className="text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent"
          >
            Redeem a master
          </a>
          <InstallAppButton
            testId="footer"
            className="text-left text-xs tracking-[0.16em] text-subtle uppercase transition-colors duration-150 hover:text-accent sm:text-right"
          />
        </div>
      </div>
    </footer>
  );
}
