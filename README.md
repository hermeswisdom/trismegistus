# Atman Music

A listening wall for the full SoundCloud catalog.

Play a tablet. Read the verse. Leave a mark.

ATMAN glows with the track’s volume. Matrix rain over the lockup. No genres — each tablet keeps its own meaning.

```bash
npm install
npm run dev
```

Requires Node 22.

## The rite

- **Today’s tablet** — one catalog pick for the Europe/London civil day, the same for every visitor. Share `/?daily=1` or `/?tablet=slug`. Listen thirty seconds to write a streak in `localStorage` only. The wall then says **come back tomorrow**.
- **Share** — Web Share / clipboard send an Atman Music title, verse line, and wall URL (not SoundCloud). Home and tablet links unfurl with cover art as the OG image.
- **The board** — every listen writes an anonymous mark (Postgres / PGLite). Ranks crown the top tablet. A recent pulse keeps the room inhabited. Soft cookie / IP rate limits keep the count from being gamed.
- **First spin** — the first visit lands a tablet on the wheel so the axle is never empty. Returning visitors resume the last tablet (localStorage; Neon when signed in).

Auth stays optional. `VITE_AUTH_ENABLED=false` is the shipped path.

Production persistence needs `DATABASE_URL` (Neon / Postgres). Without it, local and preview use in-memory PGLite — marks reset when the process does. No Blob token is required.

Live on `main` of [hermeswisdom/trismegistus](https://github.com/hermeswisdom/trismegistus). Production is [https://atmanmusic.app](https://atmanmusic.app). Custom domain `atmanmusic.com` is pending DNS.

## Accounts

Listening, hearts, and anonymous marks work without a login. An account is optional: it keeps a private name on marks you leave, saves favorites to Neon, and restores the last tablet.

The wall never forces sign-in for playback. With auth off, favorites and last tablet stay in `localStorage`.

### Vercel Production env

`VITE_*` values are baked at build time. After changing them, redeploy.

| Variable | Required for accounts | Notes |
| --- | --- | --- |
| `VITE_AUTH_ENABLED` | Yes | Must be `true` (not the string `"false"`). Production is currently `false`, which hides live sessions and shows the gated `/login` copy. |
| `BETTER_AUTH_SECRET` | Yes | Long random string. Used to sign session cookies. |
| `BETTER_AUTH_URL` | Yes | Canonical origin, `https://atmanmusic.app`. Email sign-up/sign-in also trust `https://www.atmanmusic.app` and `https://trismegistus-smlc-1397.vercel.app` (Production alias; currently 308s to `.app`). |
| `BETTER_AUTH_TRUSTED_ORIGINS` | No | Optional extra origins (comma or space separated). Do not set a `*.vercel.app` wildcard. |
| `DATABASE_URL` | Already set | Neon. Auth tables apply from globbed `migrations/0001_auth.sql` (copy of `migrations/auth/0001_auth.sql`). |
| `GROK_AUTH_ISSUER` | Optional | Broker for Google / X. Omit to keep email + password only. Google/X stay hidden until these are set. |
| `GROK_AUTH_CLIENT_ID` | Optional | Per-app broker client. |
| `GROK_AUTH_CLIENT_SECRET` | Optional | Per-app broker secret. |

OAuth is **full-page redirect**, not a popup (popups fail on iOS). Callbacks:

- `https://<BETTER_AUTH_URL>/api/auth/oauth2/callback/grok-google`
- `https://<BETTER_AUTH_URL>/api/auth/oauth2/callback/grok-x`

Email + password is enabled in-app (`src/lib/auth/email-password.ts`) and does not need the broker.

Session cookies are `__Host-` prefixed, so they are bound to one host. Sign up and sign in on the same host (`atmanmusic.app` vs `www` vs a Vercel alias are different cookies). Prefer `https://atmanmusic.app`.

### Local

Copy `.env.example` and set `VITE_AUTH_ENABLED=true` plus a `BETTER_AUTH_SECRET`. Without `DATABASE_URL`, sessions persist in local PGLite.

### Neon migration (Rivet)

`npm run build` applies `migrations/*.sql` to `DATABASE_URL`. Preview/PGLite applies the same files on boot.

If a Neon database missed the Vercel build step, run `0007_favorites_prefs.sql` once (creates `user_favorites` and `user_prefs`). Earlier files `0001`–`0006` should already be on production.
