import { useEffect, useState, type FormEvent } from "react";
import { addSignal, listSignals, type SignalNote } from "@/lib/signals";

export function Signal() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<SignalNote[]>([]);

  useEffect(() => {
    void listSignals().then(setNotes);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim() || busy) return;
    setBusy(true);
    try {
      const next = await addSignal({
        data: { author: name.trim(), body: message.trim() },
      });
      setNotes(next);
      setSent(true);
      setName("");
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="signal" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:py-28">
        <div>
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">
            Correspondence
          </p>
          <h2 className="mt-3 font-display text-section text-fg">Leave a tablet.</h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            Name and message. If a reply is warranted, the messenger will find
            you. There is no newsletter.
          </p>
          {notes.length > 0 ? (
            <ul className="mt-10 space-y-6">
              {notes.slice(0, 6).map((note) => (
                <li key={note.id}>
                  <p className="text-xs tracking-[0.2em] text-accent uppercase">
                    {note.author}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-fg/85">
                    {note.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {sent ? (
          <div className="flex flex-col justify-center border border-border px-6 py-10">
            <p className="font-display text-3xl italic text-fg">Received.</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              The tablet is kept. It sits with the others.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-8 inline-flex h-12 w-fit items-center bg-fg px-8 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-opacity duration-150 hover:opacity-90"
            >
              Another
            </button>
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
                maxLength={40}
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
                maxLength={480}
                suppressHydrationWarning
                className="w-full resize-none border-0 border-b border-border bg-transparent px-0 py-3 text-base text-fg outline-none transition-[border-color] duration-150 placeholder:text-subtle focus:border-fg"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex h-12 w-fit items-center justify-center bg-fg px-8 text-xs font-medium tracking-[0.2em] text-bg uppercase transition-opacity duration-150 hover:opacity-90 active:scale-[0.96] disabled:opacity-50"
            >
              {busy ? "Holding" : "Transmit"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
