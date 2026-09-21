# Atman Music

Esoteric Vibrations. A listening wall for the full SoundCloud catalog.

Play a tablet. Read the verse. Leave a mark.

ATMAN glows with the track’s volume. Matrix rain over the lockup. No genres — each tablet keeps its own meaning.

```bash
npm install
npm run dev
```

Requires Node 22.

## The rite

- **Today’s tablet** — one catalog pick for the Europe/London civil day, the same for every visitor. Share `/?daily=1` or `/?tablet=slug`. Listen thirty seconds to write an anonymous streak in `localStorage` only.
- **The board** — every listen writes an anonymous mark (Postgres / PGLite). Ranks crown the top tablet. A recent pulse keeps the room inhabited. Soft cookie / IP rate limits keep the count from being gamed.
- **First spin** — the first visit lands a tablet on the wheel so the axle is never empty. Returning visitors are left alone.

Auth stays optional. `VITE_AUTH_ENABLED=false` is the shipped path.

Production persistence needs `DATABASE_URL` (Neon / Postgres). Without it, local and preview use in-memory PGLite — marks reset when the process does. No Blob token is required.

Live on `main` of [hermeswisdom/trismegistus](https://github.com/hermeswisdom/trismegistus).
