import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type DownloadGrantPayload = {
  sessionId: string;
  trackId: string;
  exp: number;
};

export function newDownloadToken(): string {
  return randomBytes(24).toString("hex");
}

export function signDownloadGrant(
  grant: DownloadGrantPayload,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(grant), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDownloadGrant(
  token: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): DownloadGrantPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<DownloadGrantPayload>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.trackId !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp <= nowSec) return null;
    if (!parsed.sessionId.trim() || !parsed.trackId.trim()) return null;
    return {
      sessionId: parsed.sessionId,
      trackId: parsed.trackId,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function tokenSecretFromEnv(
  env: Record<string, string | undefined> = process.env,
): string {
  return (
    env.DOWNLOAD_TOKEN_SECRET?.trim() ||
    env.BETTER_AUTH_SECRET?.trim() ||
    env.STRIPE_WEBHOOK_SECRET?.trim() ||
    env.STRIPE_SECRET_KEY?.trim() ||
    "atman-download-dev-only"
  );
}
