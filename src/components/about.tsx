import { TRACKS } from "@/lib/rooms";

export function About() {
  return (
    <section id="office" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-28">
        <div className="order-2 lg:order-1">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            Esoteric music
          </p>
          <h2 className="mt-3 font-display text-section text-fg">
            An old soul. A modern body with a futuristic state of mind.
          </h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted sm:text-base">
            <p className="font-display text-xl text-fg sm:text-2xl">
              The observer of truth using music and encoded esoteric messages —
              and of course music that moves the soul, often inspired by the moment.
            </p>
            <p>
              TRISMEGISTUS records as Esoteric Vibrations. The covers are the current.
              There is no press photo. If a voice appears that was not invited, it
              stays.
            </p>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <div>
              <dt className="text-xs tracking-[0.2em] text-subtle uppercase">Channel</dt>
              <dd className="mt-1 text-fg">Esoteric Vibrations</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.2em] text-subtle uppercase">Form</dt>
              <dd className="mt-1 text-fg">{TRACKS.length} tablets</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.2em] text-subtle uppercase">Epithet</dt>
              <dd className="mt-1 text-fg">Thrice-great</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.2em] text-subtle uppercase">Press</dt>
              <dd className="mt-1 text-fg">Declined</dd>
            </div>
          </dl>
        </div>
        <div className="order-1 grid grid-cols-2 gap-3 lg:order-2">
          <img
            src="/images/tracks/now-i-see-you-blossom.jpg"
            alt="Sleeve for Now I See You Blossom"
            className="col-span-1 h-full min-h-72 w-full object-cover sm:min-h-96"
          />
          <div className="flex flex-col gap-3">
            <img
              src="/images/tracks/dont-look-up.jpg"
              alt="Sleeve for Don't Look Up"
              className="h-44 w-full object-cover sm:h-56"
            />
            <img
              src="/images/tracks/the-endless-mirror.jpg"
              alt="Sleeve for The Endless Mirror"
              className="min-h-0 flex-1 w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
