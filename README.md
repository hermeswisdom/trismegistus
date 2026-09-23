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

- **Today’s tablet** — one catalog pick for the Europe/London civil day, the same for every visitor. Share `/?daily=1` (Share the day) or `/?tablet=slug`. Listen thirty seconds to write a streak in `localStorage` only. The wall then says **come back tomorrow**.
- **Saved shelf** — hearted tablets gather in a dedicated shelf (`#saved`), not only the wall filter. Signed-out hearts stay on the phone; a name syncs them to Neon.
- **Share** — Web Share / clipboard send an Atman Music title, verse line, and wall URL (not SoundCloud). Home and tablet links unfurl with cover art as the OG image. Today's tablet shares `/?daily=1`.
- **The board** — every listen writes an anonymous mark (Postgres / PGLite). Rank is the count. Named comments stay private on the tablet. A recent pulse keeps the room inhabited. Soft cookie / IP rate limits keep the count from being gamed.
- **First spin** — the first visit lands a tablet on the wheel so the axle is never empty. Returning visitors resume the last tablet (localStorage; Neon when signed in).

Auth stays optional. `VITE_AUTH_ENABLED=false` is the shipped path.

Production persistence needs `DATABASE_URL` (Neon / Postgres). Without it, local and preview use in-memory PGLite — marks reset when the process does. Listening does not need a Blob token. Paid master downloads do (`BLOB_READ_WRITE_TOKEN`).

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

If a Neon database missed the Vercel build step, run `0007_favorites_prefs.sql` once (creates `user_favorites` and `user_prefs`) and `0008_mp3_purchases.sql` for paid master receipts. Earlier files `0001`–`0006` should already be on production.

## Paid master MP3s · £0.99

SoundCloud on the wall stays free. Atman can sell a **raw master MP3** for **£0.99 GBP** (99 pence) — personal use only. The stream is never ripped. Masters are private files you upload.

Copy on the wall: **Download MP3 · £0.99** and **Raw master MP3 · personal use**.

### What the buyer sees

1. A Buy button only on tablets with a configured master (`downloadKey` on the catalog row, or `MASTER_SALE_SLUGS`).
2. Stripe Checkout (GBP). Success returns to `/download?session_id=…` and starts the file.
3. Cancel returns to `/download?cancelled=1&tablet=slug`.
4. Re-download with the same success URL or `/download?receipt=…` for **48 hours** or **8 uses**, whichever ends first.

Auth stays off for v1. Checkout collects email for the Stripe receipt.

### Map a catalog track to a master

Default Blob path is `masters/<slug>.mp3`. Every catalog id already maps to that path in `src/lib/masters.ts` (`catalogMasterPaths()`). Sale is opt-in.

After a file exists in Blob, add `downloadKey` on that row in `src/lib/soundcloud-tracks.ts`:

```ts
{
  id: "the-sleepers-waking",
  slug: "the-sleepers-waking",
  downloadKey: "masters/the-sleepers-waking.mp3",
  // …
}
```

Ninety-eight catalog tablets already have `downloadKey`. **Lift Me Up** and **Remember-who-you Are V2** stay on the wall without a Buy button until their masters are uploaded. Starseed Child and Sunset Trap are off the wall.

### Upload a master (Vercel Blob)

Create a **Private** Blob store on the Vercel project. Vercel sets `BLOB_READ_WRITE_TOKEN` / `BLOB_STORE_ID`. Never commit the token or the MP3s.

```bash
# Real master you own — not a SoundCloud rip
npm run masters:upload -- ~/Music/sleepers-master.mp3 the-sleepers-waking

# Local silent file only — production uses private Blob masters
npm run masters:fixture
```

The script puts the file at `masters/<slug>.mp3` (`access: 'private'`, no random suffix) and prints the `downloadKey` snippet.

The Sleepers Waking master is live in Blob (`masters/the-sleepers-waking.mp3`). Local `masters/` (gitignored) or `fixtures/masters/` are only used when Blob is unset.

### Stripe (test mode first)

1. Stripe Dashboard → Developers → API keys → **test** `sk_test_…` and `pk_test_…`.
2. Webhooks → Add endpoint `https://<this-host>/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy `whsec_…`.
3. Local: `stripe listen --forward-to localhost:8080/api/stripe/webhook`.
4. **Live switch:** replace `sk_test_` / `pk_test_` / `whsec_` with `sk_live_` / `pk_live_` / the live webhook secret. Recreate the webhook on the production host (`https://atmanmusic.app/api/stripe/webhook`). Do not reuse the test secret.

Optional: create a Stripe Price for **£0.99 GBP** and set `STRIPE_PRICE_ID`. When unset, Checkout sends `price_data` at `MASTER_PRICE_PENCE` (default 99).

### Env

| Variable | Required for live sales | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | `sk_test_…` first, then `sk_live_…`. |
| `STRIPE_WEBHOOK_SECRET` | Yes | `whsec_…` from the webhook endpoint. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | No | Checkout is server-side; keep `pk_test_` / `pk_live_` for later UI. |
| `STRIPE_PRICE_ID` | No | When set, Checkout uses this Price instead of 99p `price_data`. |
| `MASTER_PRICE_PENCE` | No | Default `99`. |
| `VITE_MASTER_PRICE_PENCE` | No | Button label; keep in sync with `MASTER_PRICE_PENCE`. |
| `DOWNLOAD_TOKEN_SECRET` | Recommended | Signs 10-minute download links. Falls back to `BETTER_AUTH_SECRET`. |
| `BLOB_READ_WRITE_TOKEN` | Yes for real files | Private Blob. |
| `BLOB_STORE_ID` | Optional | OIDC on Vercel. |
| `MASTER_DRY_RUN` | Preview only | `1` skips Stripe. Serves the Blob master when configured, otherwise a local fallback file. |
| `MASTER_SALE_SLUGS` | No | Extra slugs (`fragile-god,awake`) or `*` to enable default paths. |
| `DATABASE_URL` | Yes in production | Stores session id → track id receipts (`0008_mp3_purchases.sql`). |

### Dry-run (no Stripe / no Blob)

```bash
MASTER_DRY_RUN=1 npm run dev
```

Open a tablet with a Buy button → Checkout skips Stripe and `/download?session_id=dry_…` starts the file. Production uses the Blob master.

Without `MASTER_DRY_RUN` and without `STRIPE_SECRET_KEY`, the Buy button explains that Checkout is not configured.

Do not put live Stripe keys in git.
