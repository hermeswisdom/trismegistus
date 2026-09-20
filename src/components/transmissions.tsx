import { JOURNAL } from "@/lib/rooms";

export function Transmissions() {
  return (
    <section id="transmissions" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <p className="text-xs font-medium tracking-[0.32em] text-muted uppercase">
          Tablets
        </p>
        <h2 className="mt-3 font-display text-section italic text-fg">Transmissions</h2>
        <ul className="mt-12 divide-y divide-border border-y border-border">
          {JOURNAL.map((entry) => (
            <li key={entry.title} className="grid gap-3 py-8 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-10">
              <p className="text-xs tabular-nums tracking-[0.18em] text-subtle">{entry.date}</p>
              <div>
                <h3 className="font-display text-2xl italic text-fg">{entry.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                  {entry.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
