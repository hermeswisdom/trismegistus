/**
 * Origins Better Auth accepts on credentialed POSTs (email sign-up / sign-in).
 *
 * Production sets `BETTER_AUTH_URL` to the canonical host. Without extra
 * entries, a direct hit on www or a Vercel Production alias is FORBIDDEN
 * (`Invalid origin`). This list is explicit — never `*.vercel.app`.
 */

export const LOCAL_DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
] as const;

export const PRODUCTION_ORIGINS = [
  "https://atmanmusic.app",
  "https://www.atmanmusic.app",
  "https://trismegistus-smlc-1397.vercel.app",
] as const;

export type TrustedOriginInput = {
  betterAuthUrl?: string;
  extraOrigins?: string;
  previewHosts?: readonly string[];
};

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseExtraOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const origin = normalizeOrigin(part);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

function pushUnique(out: string[], seen: Set<string>, value: string): void {
  if (!value || seen.has(value)) return;
  seen.add(value);
  out.push(value);
}

/**
 * Build the Better Auth `trustedOrigins` list.
 *
 * Deployed (`BETTER_AUTH_URL` set): canonical URL + known Production hosts +
 * optional `BETTER_AUTH_TRUSTED_ORIGINS` + loopback.
 * Preview (no explicit URL): grok-sandbox wildcards + loopback.
 */
export function resolveTrustedOrigins(input: TrustedOriginInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const addOrigin = (value: string | undefined) => {
    if (!value) return;
    const origin = normalizeOrigin(value);
    if (origin) pushUnique(out, seen, origin);
  };

  if (input.betterAuthUrl) {
    addOrigin(input.betterAuthUrl);
    for (const origin of PRODUCTION_ORIGINS) addOrigin(origin);
  } else {
    for (const host of input.previewHosts ?? []) {
      pushUnique(out, seen, host);
      pushUnique(out, seen, `https://${host}`);
      pushUnique(out, seen, `http://${host}`);
    }
  }

  for (const origin of parseExtraOrigins(input.extraOrigins)) {
    pushUnique(out, seen, origin);
  }
  for (const origin of LOCAL_DEV_ORIGINS) pushUnique(out, seen, origin);
  return out;
}
