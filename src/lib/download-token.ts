import { SignJWT, jwtVerify } from "jose";
import {
  DOWNLOAD_LINK_TTL_MS,
  DOWNLOAD_TTL_MS,
  MAX_MASTER_DOWNLOADS,
} from "./masters.ts";

export type DownloadGrant = {
  sid: string;
  tid: string;
  key: string;
  rec: string;
};

export type PurchaseGate = {
  expiresAtMs: number;
  downloadCount: number;
  maxDownloads: number;
};

export function canRedeemPurchase(
  gate: PurchaseGate,
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (now >= gate.expiresAtMs) {
    return { ok: false, reason: "This download window has closed (48 hours)." };
  }
  if (gate.downloadCount >= gate.maxDownloads) {
    return { ok: false, reason: "This receipt has no downloads left." };
  }
  return { ok: true };
}

export function downloadsLeft(gate: Pick<PurchaseGate, "downloadCount" | "maxDownloads">): number {
  return Math.max(0, gate.maxDownloads - gate.downloadCount);
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signDownloadToken(
  grant: DownloadGrant,
  secret: string,
  now = Date.now(),
  ttlMs = DOWNLOAD_LINK_TTL_MS,
): Promise<string> {
  return new SignJWT({
    sid: grant.sid,
    tid: grant.tid,
    key: grant.key,
    rec: grant.rec,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor((now + ttlMs) / 1000))
    .setSubject("atman-master")
    .sign(secretKey(secret));
}

export async function verifyDownloadToken(
  token: string,
  secret: string,
): Promise<DownloadGrant> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    algorithms: ["HS256"],
    subject: "atman-master",
  });
  const sid = typeof payload.sid === "string" ? payload.sid : "";
  const tid = typeof payload.tid === "string" ? payload.tid : "";
  const key = typeof payload.key === "string" ? payload.key : "";
  const rec = typeof payload.rec === "string" ? payload.rec : "";
  if (!sid || !tid || !key || !rec) {
    throw new Error("Download token is missing claims.");
  }
  return { sid, tid, key, rec };
}

export function receiptTtlMs(): number {
  return DOWNLOAD_TTL_MS;
}

export function defaultMaxDownloads(): number {
  return MAX_MASTER_DOWNLOADS;
}
