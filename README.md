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

Production persistence needs `DATABASE_URL` (Neon / Postgres). Without it, local and preview use in-memory PGLite — marks reset when the process does. Paid master MP3s need Vercel Blob (`BLOB_READ_WRITE_TOKEN`); listening does not.

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

## Paid master MP3s

SoundCloud on the wall stays free. Atman can sell a **raw master MP3** for a tablet he owns. The stream is never ripped. Masters live in private **Vercel Blob**, not git.

The Buy button (`Download MP3 · £X`) only appears when that catalog row has `downloadKey` in `src/lib/soundcloud-tracks.ts`. Tablets without a master show no button.

Default scaffolding price is **£1.99 GBP** per track when `TRACK_DOWNLOAD_PRICE_GBP` is unset.

### Upload a master

1. Create a Vercel Blob store on the project. Copy `BLOB_READ_WRITE_TOKEN`.
2. Upload the private file (path must be `masters/<slug>.mp3`):

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_… node scripts/upload-master.mjs ./the-sleepers-waking.mp3 the-sleepers-waking
```

3. Set `downloadKey: "the-sleepers-waking"` on that track in `src/lib/soundcloud-tracks.ts` (the sample tablet already has this).
4. Redeploy. Until Blob has the file, preview/local serves a silent fixture so the checkout path can be tested. Production without a Blob object returns 404 after payment — upload before going live.

### Price

| Variable | Role |
| --- | --- |
| `TRACK_DOWNLOAD_PRICE_GBP` | Server amount for Checkout `price_data` (GBP). Default **1.99**. |
| `VITE_TRACK_DOWNLOAD_PRICE_GBP` | Optional matching client label (baked at build). Falls back to 1.99. |
| `TRACK_DOWNLOAD_PRICE_ID` | Shared Stripe Price ID (`price_…`) for every sold track. |
| `TRACK_DOWNLOAD_PRICE_IDS` | JSON map `{ "track-id": "price_…" }` when prices differ. |

Price IDs win over the GBP amount. Keep test Prices in test mode.

### Stripe (test mode first)

1. Use **test** keys (`sk_test_…`, `pk_test_…`). Do not put live keys on preview until Atman QC’s the HOLD PR.
2. Set on Vercel Preview (and later Production):

| Variable | Required | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes for real Checkout | `sk_test_…` first. Restricted key (`rk_test_…`) is fine if it can create Checkout Sessions and read them. |
| `STRIPE_WEBHOOK_SECRET` | Yes for fulfillment | From the webhook endpoint below. |
| `STRIPE_PUBLISHABLE_KEY` | No for hosted Checkout | Optional; reserved if we embed later. |
| `BLOB_READ_WRITE_TOKEN` | Yes for real masters | Private store. |
| `DOWNLOAD_TOKEN_SECRET` | Recommended | Signs download URLs. Falls back to `BETTER_AUTH_SECRET` / Stripe secrets. |
| `DOWNLOAD_TOKEN_TTL_HOURS` | No | Default **48**. |
| `DOWNLOAD_MAX_USES` | No | Default **6**. |
| `DOWNLOAD_DRY_RUN` | No | Force the no-charge path. Auto-on when Stripe is unset and `VERCEL_ENV` is not `production`. |
| `DOWNLOAD_ALLOW_FIXTURE` | No | Serve `fixtures/masters/sample.mp3` when Blob is empty. Off in production unless forced. |

3. Webhook (Stripe Dashboard → Developers → Webhooks, **test** endpoint first):

- URL: `https://<preview-or-prod-host>/api/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- Paste the signing secret into `STRIPE_WEBHOOK_SECRET`

Local listen (optional):

```bash
stripe listen --forward-to localhost:8080/api/stripe/webhook
```

Checkout is created only on the server. The webhook writes `track_purchases` (`session_id` → `track_id`). The success page also retrieves the session if the webhook is late, so a paid session still unlocks.

Success: `/download/success?session_id={CHECKOUT_SESSION_ID}` — starts the download and stays valid ~48h / a few uses. Cancel: `/download/cancel`. Stripe’s receipt email is enough for v1 (no app login). Re-open the success URL from the browser history or bookmark.

### Go live

Switch `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PUBLISHABLE_KEY` to `sk_live_` / live webhook secret / `pk_live_`. Add a **live** webhook to the production host. Keep test keys on Preview. Never commit secrets.

`0008_track_purchases.sql` applies on `npm run build` when `DATABASE_URL` is set (same as the other migrations).
