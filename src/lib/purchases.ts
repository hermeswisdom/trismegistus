import { env } from "@/lib/env.server";
import { defaultMaxDownloads } from "@/lib/download-token";
import {
  DOWNLOAD_TTL_MS,
  dryRunSessionId,
  parseSaleSlugs,
  randomNonce,
  resolveSaleDownloadKey,
  saleTrack,
  trackIdFromDryRunSession,
} from "@/lib/masters";
import { getTrack } from "@/lib/rooms";

export type PurchaseRow = {
  sessionId: string;
  trackId: string;
  downloadKey: string;
  email: string | null;
  receiptToken: string;
  downloadCount: number;
  maxDownloads: number;
  paidAt: string;
  expiresAt: string;
};

export type RedeemOk = {
  ok: true;
  trackId: string;
  title: string;
  token: string;
  downloadUrl: string;
  receipt: string;
  receiptUrl: string;
  expiresAt: string;
  downloadsLeft: number;
  license: string;
  fixture: boolean;
  dryRun: boolean;
};

export type RedeemErr = {
  ok: false;
  error: string;
};

export function downloadTokenSecret(): string {
  return (
    env("DOWNLOAD_TOKEN_SECRET") ??
    env("BETTER_AUTH_SECRET") ??
    env("STRIPE_WEBHOOK_SECRET") ??
    (masterDryRunEnabled() ? "atman-master-dry-run" : "")
  );
}

export function masterDryRunEnabled(): boolean {
  const flag = env("MASTER_DRY_RUN")?.toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function extraSaleSlugs() {
  return parseSaleSlugs(env("MASTER_SALE_SLUGS"));
}

export function saleKeyForTrackId(trackId: string): string | undefined {
  const track = getTrack(trackId);
  if (!track) return undefined;
  return resolveSaleDownloadKey(track, extraSaleSlugs());
}

async function sqlClient() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export async function findPurchaseBySession(
  sessionId: string,
): Promise<PurchaseRow | null> {
  try {
    const sql = await sqlClient();
    const rows = await sql<PurchaseRow>`
      select
        session_id as "sessionId",
        track_id as "trackId",
        download_key as "downloadKey",
        email,
        receipt_token as "receiptToken",
        download_count as "downloadCount",
        max_downloads as "maxDownloads",
        paid_at::text as "paidAt",
        expires_at::text as "expiresAt"
      from mp3_purchases
      where session_id = ${sessionId}
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function findPurchaseByReceipt(
  receiptToken: string,
): Promise<PurchaseRow | null> {
  try {
    const sql = await sqlClient();
    const rows = await sql<PurchaseRow>`
      select
        session_id as "sessionId",
        track_id as "trackId",
        download_key as "downloadKey",
        email,
        receipt_token as "receiptToken",
        download_count as "downloadCount",
        max_downloads as "maxDownloads",
        paid_at::text as "paidAt",
        expires_at::text as "expiresAt"
      from mp3_purchases
      where receipt_token = ${receiptToken}
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function upsertPaidPurchase(input: {
  sessionId: string;
  trackId: string;
  downloadKey: string;
  email?: string;
}): Promise<PurchaseRow | null> {
  const receiptToken = randomNonce(24);
  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);
  const sql = await sqlClient();
  const rows = await sql<PurchaseRow>`
    insert into mp3_purchases (
      session_id,
      track_id,
      download_key,
      email,
      receipt_token,
      max_downloads,
      expires_at
    )
    values (
      ${input.sessionId},
      ${input.trackId},
      ${input.downloadKey},
      ${input.email ?? null},
      ${receiptToken},
      ${defaultMaxDownloads()},
      ${expiresAt.toISOString()}
    )
    on conflict (session_id) do update
      set email = coalesce(excluded.email, mp3_purchases.email)
    returning
      session_id as "sessionId",
      track_id as "trackId",
      download_key as "downloadKey",
      email,
      receipt_token as "receiptToken",
      download_count as "downloadCount",
      max_downloads as "maxDownloads",
      paid_at::text as "paidAt",
      expires_at::text as "expiresAt"
  `;
  return rows[0] ?? null;
}

export async function consumeDownload(sessionId: string): Promise<PurchaseRow | null> {
  const sql = await sqlClient();
  const rows = await sql<PurchaseRow>`
    update mp3_purchases
    set
      download_count = download_count + 1,
      last_download_at = now()
    where session_id = ${sessionId}
      and download_count < max_downloads
      and expires_at > now()
    returning
      session_id as "sessionId",
      track_id as "trackId",
      download_key as "downloadKey",
      email,
      receipt_token as "receiptToken",
      download_count as "downloadCount",
      max_downloads as "maxDownloads",
      paid_at::text as "paidAt",
      expires_at::text as "expiresAt"
  `;
  return rows[0] ?? null;
}

export async function ensureDryRunPurchase(sessionId: string): Promise<PurchaseRow | null> {
  const existing = await findPurchaseBySession(sessionId);
  if (existing) return existing;
  const trackId = trackIdFromDryRunSession(sessionId);
  if (!trackId) return null;
  const key = saleKeyForTrackId(trackId);
  if (!key) return null;
  try {
    return await upsertPaidPurchase({
      sessionId,
      trackId,
      downloadKey: key,
    });
  } catch {
    return {
      sessionId,
      trackId,
      downloadKey: key,
      email: null,
      receiptToken: randomNonce(24),
      downloadCount: 0,
      maxDownloads: defaultMaxDownloads(),
      paidAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + DOWNLOAD_TTL_MS).toISOString(),
    };
  }
}

export function newDryRunCheckout(trackId: string): string {
  return dryRunSessionId(trackId);
}

export function trackForCheckout(trackId: string) {
  const track = saleTrack(trackId) ?? getTrack(trackId);
  if (!track) return undefined;
  const downloadKey = resolveSaleDownloadKey(track, extraSaleSlugs());
  if (!downloadKey) return undefined;
  return { track, downloadKey };
}
