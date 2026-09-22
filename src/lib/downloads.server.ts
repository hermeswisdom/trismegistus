import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { env } from "@/lib/env.server";
import {
  checkoutIntegrationId,
  DEFAULT_DOWNLOAD_MAX_USES,
  DEFAULT_DOWNLOAD_TTL_HOURS,
  DOWNLOAD_LEGAL,
  downloadFilename,
  getSellableTrack,
  isDryRunSessionId,
  masterBlobPath,
  parsePositiveInt,
  parsePriceIdMap,
  priceToPence,
  allowDryRunDownloads,
  allowFixtureMaster,
  serverPriceGbp,
  type CheckoutStart,
  type DownloadGrantResult,
  type DownloadGrantView,
  type Storefront,
} from "@/lib/downloads-core";
import {
  newDownloadToken,
  signDownloadGrant,
  tokenSecretFromEnv,
  verifyDownloadGrant,
} from "@/lib/download-token";
import { SITE_ORIGIN } from "@/lib/tablet-link";
import { TRACKS } from "@/lib/rooms";

function sellable(trackId: string) {
  return getSellableTrack(trackId, TRACKS);
}

export type {
  CheckoutStart,
  DownloadGrantResult,
  DownloadGrantView,
  Storefront,
};

type PurchaseRow = {
  sessionId: string;
  trackId: string;
  downloadKey: string;
  email: string | null;
  token: string;
  expiresAt: string;
  usesRemaining: number;
  dryRun: boolean;
};

const FIXTURE_PATH = "fixtures/masters/sample.mp3";

function stripeSecret(): string | undefined {
  return env("STRIPE_SECRET_KEY");
}

export function getStorefront(): Storefront {
  const secret = stripeSecret();
  return {
    priceGbp: serverPriceGbp(),
    currency: "gbp",
    stripeReady: Boolean(secret),
    dryRun: allowDryRunDownloads(),
  };
}

function stripeClient(): Stripe {
  const secret = stripeSecret();
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(secret);
}

function ttlMs(): number {
  return (
    parsePositiveInt(env("DOWNLOAD_TOKEN_TTL_HOURS"), DEFAULT_DOWNLOAD_TTL_HOURS) *
    60 *
    60 *
    1000
  );
}

function maxUses(): number {
  return parsePositiveInt(env("DOWNLOAD_MAX_USES"), DEFAULT_DOWNLOAD_MAX_USES);
}

function priceIdForTrack(trackId: string): string | undefined {
  const map = parsePriceIdMap(env("TRACK_DOWNLOAD_PRICE_IDS"));
  if (map[trackId]) return map[trackId];
  const shared = env("TRACK_DOWNLOAD_PRICE_ID");
  return shared?.startsWith("price_") ? shared : undefined;
}

export async function publicOrigin(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host) {
      const proto =
        request.headers.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.")
          ? "http"
          : "https");
      return `${proto}://${host}`;
    }
  } catch {
    /* fall through */
  }
  const authUrl = env("BETTER_AUTH_URL")?.replace(/\/$/, "");
  if (authUrl) return authUrl;
  const vercelHost = env("VERCEL_PROJECT_PRODUCTION_URL");
  if (vercelHost) return `https://${vercelHost}`;
  return SITE_ORIGIN;
}

async function sql() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function insertPurchase(row: {
  sessionId: string;
  trackId: string;
  downloadKey: string;
  email?: string | null;
  token: string;
  expiresAt: Date;
  usesRemaining: number;
  dryRun: boolean;
}): Promise<void> {
  const db = await sql();
  await db`
    insert into track_purchases (
      session_id, track_id, download_key, email, token,
      expires_at, uses_remaining, dry_run
    )
    values (
      ${row.sessionId}, ${row.trackId}, ${row.downloadKey},
      ${row.email ?? null}, ${row.token}, ${row.expiresAt.toISOString()},
      ${row.usesRemaining}, ${row.dryRun}
    )
    on conflict (session_id) do nothing
  `;
}

async function purchaseBySession(
  sessionId: string,
): Promise<PurchaseRow | undefined> {
  const db = await sql();
  const rows = await db<PurchaseRow>`
    select
      session_id as "sessionId",
      track_id as "trackId",
      download_key as "downloadKey",
      email,
      token,
      expires_at::text as "expiresAt",
      uses_remaining as "usesRemaining",
      dry_run as "dryRun"
    from track_purchases
    where session_id = ${sessionId}
    limit 1
  `;
  return rows[0];
}

async function purchaseByToken(token: string): Promise<PurchaseRow | undefined> {
  const db = await sql();
  const rows = await db<PurchaseRow>`
    select
      session_id as "sessionId",
      track_id as "trackId",
      download_key as "downloadKey",
      email,
      token,
      expires_at::text as "expiresAt",
      uses_remaining as "usesRemaining",
      dry_run as "dryRun"
    from track_purchases
    where token = ${token}
    limit 1
  `;
  return rows[0];
}

function viewFromRow(row: PurchaseRow): DownloadGrantView | { ok: false; message: string } {
  const track = sellable(row.trackId);
  if (!track) return { ok: false, message: "This tablet is no longer for sale." };
  const exp = Date.parse(row.expiresAt);
  if (!Number.isFinite(exp) || exp <= Date.now()) {
    return { ok: false, message: "This download link has expired." };
  }
  if (row.usesRemaining <= 0) {
    return { ok: false, message: "This download link has been used up." };
  }
  const signed = signDownloadGrant(
    {
      sessionId: row.sessionId,
      trackId: row.trackId,
      exp: Math.floor(exp / 1000),
    },
    tokenSecretFromEnv(),
  );
  return {
    ok: true,
    trackId: track.id,
    slug: track.slug,
    title: track.title,
    image: track.image,
    filename: downloadFilename(track),
    downloadUrl: `/api/downloads/${encodeURIComponent(signed)}`,
    expiresAt: new Date(exp).toISOString(),
    usesRemaining: row.usesRemaining,
    dryRun: row.dryRun,
    email: row.email ?? undefined,
  };
}

export async function fulfillPaidSession(input: {
  sessionId: string;
  trackId: string;
  email?: string | null;
  dryRun?: boolean;
}): Promise<PurchaseRow> {
  const track = sellable(input.trackId);
  if (!track?.downloadKey) {
    throw new Error("Track has no master configured");
  }
  const existing = await purchaseBySession(input.sessionId);
  if (existing) return existing;
  const token = newDownloadToken();
  await insertPurchase({
    sessionId: input.sessionId,
    trackId: track.id,
    downloadKey: track.downloadKey,
    email: input.email,
    token,
    expiresAt: new Date(Date.now() + ttlMs()),
    usesRemaining: maxUses(),
    dryRun: Boolean(input.dryRun),
  });
  const row = await purchaseBySession(input.sessionId);
  if (!row) throw new Error("Failed to record purchase");
  return row;
}

async function createDryRunCheckout(trackId: string): Promise<CheckoutStart> {
  const track = sellable(trackId);
  if (!track) {
    return { ok: false, message: "No master is configured for this tablet." };
  }
  const sessionId = `dry_${newDownloadToken()}`;
  await fulfillPaidSession({
    sessionId,
    trackId: track.id,
    dryRun: true,
  });
  const origin = await publicOrigin();
  return {
    ok: true,
    dryRun: true,
    url: `${origin}/download/success?session_id=${encodeURIComponent(sessionId)}`,
  };
}

export async function createCheckout(trackId: string): Promise<CheckoutStart> {
  const track = sellable(trackId);
  if (!track) {
    return { ok: false, message: "No master is configured for this tablet." };
  }
  if (!stripeSecret()) {
    if (allowDryRunDownloads()) return createDryRunCheckout(track.id);
    return {
      ok: false,
      message: "Stripe is not configured. Set STRIPE_SECRET_KEY (test mode first).",
    };
  }

  const origin = await publicOrigin();
  const stripe = stripeClient();
  const priceId = priceIdForTrack(track.id);
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency: "gbp" as const,
          unit_amount: priceToPence(serverPriceGbp()),
          product_data: {
            name: `${track.title} — raw master MP3`,
            description: DOWNLOAD_LEGAL,
            images: track.image.startsWith("http")
              ? [track.image]
              : [`${origin}${track.image}`],
          },
        },
        quantity: 1,
      };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    integration_identifier: checkoutIntegrationId(),
    client_reference_id: track.id,
    success_url: `${origin}/download/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/download/cancel?track=${encodeURIComponent(track.id)}`,
    metadata: {
      trackId: track.id,
      downloadKey: track.downloadKey ?? "",
    },
    payment_intent_data: {
      metadata: {
        trackId: track.id,
        downloadKey: track.downloadKey ?? "",
      },
    },
    line_items: [lineItem],
    custom_text: {
      submit: {
        message:
          "Raw master MP3 · personal use. Keep the success page — re-download works for about 48 hours.",
      },
    },
  });

  if (!session.url) {
    return { ok: false, message: "Stripe did not return a checkout URL." };
  }
  return { ok: true, url: session.url, dryRun: false };
}

function sessionPaid(status: string | null | undefined): boolean {
  return status === "paid" || status === "no_payment_required";
}

async function fulfillStripeSession(session: Stripe.Checkout.Session) {
  if (!sessionPaid(session.payment_status)) return;
  const trackId =
    session.metadata?.trackId ??
    session.client_reference_id ??
    undefined;
  if (!trackId) return;
  await fulfillPaidSession({
    sessionId: session.id,
    trackId,
    email: session.customer_details?.email ?? session.customer_email,
    dryRun: false,
  });
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    return { ok: false, status: 503, message: "STRIPE_WEBHOOK_SECRET is not set" };
  }
  if (!signature) {
    return { ok: false, status: 400, message: "Missing stripe-signature" };
  }
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return { ok: false, status: 400, message: "Invalid webhook signature" };
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await fulfillStripeSession(session);
    } catch (error) {
      console.error("[downloads] webhook fulfill failed", error);
      return { ok: false, status: 500, message: "Fulfillment failed" };
    }
  }
  return { ok: true };
}

export async function loadGrant(input: {
  sessionId?: string;
  token?: string;
}): Promise<DownloadGrantResult> {
  try {
    if (input.token?.trim()) {
      const byToken = await purchaseByToken(input.token.trim());
      if (byToken) return viewFromRow(byToken);
    }

    const sessionId = input.sessionId?.trim();
    if (!sessionId) {
      return { ok: false, message: "Missing checkout session." };
    }

    const existing = await purchaseBySession(sessionId);
    if (existing) return viewFromRow(existing);

    if (isDryRunSessionId(sessionId)) {
      return { ok: false, message: "This dry-run session was not found." };
    }

    if (!stripeSecret()) {
      return {
        ok: false,
        message: "Payment is not configured, and this session is unknown.",
      };
    }

    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (!sessionPaid(session.payment_status)) {
      return { ok: false, message: "Payment is not complete yet." };
    }
    const trackId =
      session.metadata?.trackId ?? session.client_reference_id ?? undefined;
    if (!trackId) {
      return { ok: false, message: "This checkout is missing a tablet id." };
    }
    const row = await fulfillPaidSession({
      sessionId: session.id,
      trackId,
      email: session.customer_details?.email ?? session.customer_email,
    });
    return viewFromRow(row);
  } catch (error) {
    console.error("[downloads] loadGrant failed", error);
    return { ok: false, message: "Could not open this download." };
  }
}

async function consumeUse(sessionId: string): Promise<PurchaseRow | undefined> {
  const db = await sql();
  const rows = await db<PurchaseRow>`
    update track_purchases
    set uses_remaining = uses_remaining - 1
    where session_id = ${sessionId}
      and uses_remaining > 0
      and expires_at > now()
    returning
      session_id as "sessionId",
      track_id as "trackId",
      download_key as "downloadKey",
      email,
      token,
      expires_at::text as "expiresAt",
      uses_remaining as "usesRemaining",
      dry_run as "dryRun"
  `;
  return rows[0];
}

async function refundUse(sessionId: string): Promise<void> {
  const db = await sql();
  await db`
    update track_purchases
    set uses_remaining = uses_remaining + 1
    where session_id = ${sessionId}
  `;
}

async function readFixtureMp3(): Promise<Uint8Array | null> {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(process.cwd(), FIXTURE_PATH),
      join(here, "../../", FIXTURE_PATH),
    ];
    for (const path of candidates) {
      try {
        return new Uint8Array(await readFile(path));
      } catch {
        /* try next */
      }
    }
  } catch {
    /* fall through to embedded silence */
  }
  return embeddedSilentMp3();
}

/** Tiny valid MPEG frame so dry-run / missing Blob still produces a file. */
function embeddedSilentMp3(): Uint8Array {
  return Uint8Array.from([
    0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
}

async function loadMasterBytes(
  downloadKey: string,
): Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; size?: number; fixture: boolean }> {
  const pathname = masterBlobPath(downloadKey);
  if (env("BLOB_READ_WRITE_TOKEN")) {
    try {
      const { get } = await import("@vercel/blob");
      const result = await get(pathname, { access: "private" });
      if (result?.statusCode === 200 && result.stream) {
        return {
          body: result.stream,
          size: result.blob.size,
          fixture: false,
        };
      }
    } catch (error) {
      console.warn("[downloads] blob get failed", pathname, error);
    }
  }
  if (!allowFixtureMaster()) {
    throw new Error("Master file is not uploaded yet");
  }
  const bytes = await readFixtureMp3();
  if (!bytes) throw new Error("Fixture master is missing");
  return { body: bytes, size: bytes.length, fixture: true };
}

export async function streamPurchasedMaster(
  rawToken: string,
): Promise<Response> {
  const token = decodeURIComponent(rawToken);
  const grant = verifyDownloadGrant(token, tokenSecretFromEnv());
  if (!grant) {
    return new Response("Download link is invalid or expired.", { status: 403 });
  }
  const track = sellable(grant.trackId);
  if (!track?.downloadKey) {
    return new Response("Master is not configured.", { status: 404 });
  }

  let consumed: PurchaseRow | undefined;
  try {
    consumed = await consumeUse(grant.sessionId);
  } catch (error) {
    console.error("[downloads] consume failed", error);
    return new Response("Could not open this download.", { status: 500 });
  }
  if (!consumed || consumed.trackId !== grant.trackId) {
    return new Response("Download link is used up or expired.", { status: 410 });
  }

  try {
    const master = await loadMasterBytes(consumed.downloadKey);
    const filename = downloadFilename(track);
    const body =
      master.body instanceof Uint8Array
        ? Buffer.from(master.body)
        : master.body;
    const headers = new Headers({
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (master.size) headers.set("Content-Length", String(master.size));
    if (master.fixture) headers.set("X-Atman-Master", "fixture");
    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error("[downloads] stream failed", error);
    try {
      await refundUse(grant.sessionId);
    } catch {
      /* already logged */
    }
    return new Response("Master file is not uploaded yet.", { status: 404 });
  }
}

export { allowDryRunDownloads, allowFixtureMaster, serverPriceGbp };
