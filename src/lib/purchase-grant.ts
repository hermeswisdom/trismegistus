import { MASTER_LICENSE_LINE } from "@/lib/masters";
import {
  downloadTokenSecret,
  type PurchaseRow,
  type RedeemErr,
  type RedeemOk,
} from "@/lib/purchases";
import { canRedeemPurchase, downloadsLeft, signDownloadToken } from "@/lib/download-token";
import { FIXTURE_TRACK_ID, isDryRunSessionId } from "@/lib/masters";
import { getTrack } from "@/lib/rooms";

export async function grantFromExisting(
  row: PurchaseRow,
  origin: string,
): Promise<RedeemOk | RedeemErr> {
  const expiresAtMs = Date.parse(row.expiresAt);
  const allowed = canRedeemPurchase({
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
    downloadCount: row.downloadCount,
    maxDownloads: row.maxDownloads,
  });
  if (!allowed.ok) return { ok: false, error: allowed.reason };
  const secret = downloadTokenSecret();
  if (!secret) {
    return { ok: false, error: "DOWNLOAD_TOKEN_SECRET is not set." };
  }
  const track = getTrack(row.trackId);
  const token = await signDownloadToken(
    {
      sid: row.sessionId,
      tid: row.trackId,
      key: row.downloadKey,
      rec: row.receiptToken,
    },
    secret,
  );
  const base = origin.replace(/\/+$/, "");
  return {
    ok: true,
    trackId: row.trackId,
    title: track?.title ?? row.trackId,
    token,
    downloadUrl: `${base}/api/masters/download?token=${encodeURIComponent(token)}`,
    receipt: row.receiptToken,
    receiptUrl: `${base}/download?receipt=${encodeURIComponent(row.receiptToken)}`,
    expiresAt: row.expiresAt,
    downloadsLeft: downloadsLeft(row),
    license: MASTER_LICENSE_LINE,
    fixture: row.trackId === FIXTURE_TRACK_ID,
    dryRun: isDryRunSessionId(row.sessionId),
  };
}
