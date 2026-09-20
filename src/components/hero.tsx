import { ArrowDown } from "lucide-react";

export function Hero() {
  return (
    <section id="top" className="relative isolate min-h-dvh overflow-hidden">
      <img
        src="/images/hero.jpg"
        alt="An empty concert hall at night, a single bulb over a deserted stage."
        className="absolute inset-0 size-full object-cover outline-none brightness-150 contrast-110"
      />
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-bg via-bg/70 to-transparent" />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-end px-5 pb-28 pt-28 sm:px-8 sm:pb-32">
        <p className="text-xs font-medium tracking-[0.42em] text-accent uppercase">
          Esoteric Vibrations · 2026
        </p>
        <h2 className="mt-5 font-display text-display italic text-fg">TRISMEGISTUS</h2>
        <p className="mt-6 max-w-md text-lead font-light text-fg/80">
          The full SoundCloud catalog. Every cover. Every tablet.
        </p>
        <a
          href="#listen"
          className="mt-10 inline-flex h-11 w-fit items-center gap-2 text-xs font-medium tracking-[0.22em] text-muted uppercase transition-colors duration-150 hover:text-fg"
        >
          <ArrowDown className="size-3.5" strokeWidth={1.75} />
          Open the rooms
        </a>
      </div>
    </section>
  );
}
