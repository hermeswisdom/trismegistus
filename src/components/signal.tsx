import { useState, type FormEvent } from "react";

export function Signal() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setSent(true);
  }

  return (
    <section id="signal" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
        <div>
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            Correspondence
          </p>
          <h2 className="mt-3 font-display text-section text-fg">Leave a tablet.</h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            Esoteric scores, rooms, and closed sessions. If a reply is
            warranted, the messenger will find you. There is no newsletter.
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col justify-center border border-border px-6 py-10">
            <p className="font-display text-3xl italic text-fg">Received.</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              The tablet is received. If a reply is warranted, it will find you.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <label className="block">
              <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
                Name
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-base text-fg outline-none transition-[border-color] duration-150 placeholder:text-subtle focus:border-fg"
                autoComplete="name"
                suppressHydrationWarning
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
                Channel
              </span>
              <input
                type="email"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Where a reply could land"
                className="h-12 w-full border-0 border-b border-border bg-transparent px-0 text-base text-fg outline-none transition-[border-color] duration-150 placeholder:text-subtle focus:border-fg"
                autoComplete="email"
                suppressHydrationWarning
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs tracking-[0.2em] text-subtle uppercase">
                Message
              </span>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                suppressHydrationWarning

                className="w-full resize-none border-0 border-b border-border bg-transparent px-0 py-3 text-base text-fg outline-none transition-[border-color] duration-150 placeholder:text-subtle focus:border-fg"
              />
            </label>
            <button
              type="submit"
              className="mt-2 inline-flex h-12 w-fit items-center justify-center bg-fg px-8 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-opacity duration-150 hover:opacity-90 active:scale-[0.96]"
            >
              Transmit
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
