/**
 * Origins Better Auth accepts on credentialed POSTs (email sign-up / sign-in).
 *
 * Better Auth matches Origin with exact string equality against
 * `URL.origin` (no trailing slash). If `BETTER_AUTH_URL` is stored as
 * `https://atmanmusic.app/`, a raw allowlist entry will never match
 * `Origin: https://atmanmusic.app`. Always strip slashes when adding.
 *
 * Production hosts below are always trusted — not `*.vercel.app`.
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

/** Trim and drop trailing slashes (`https://atmanmusic.app/` → `https://atmanmusic.app`). */
export function stripTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/** Canonical Better Auth `baseURL` (empty / whitespace → unset). */
export function normalizeBaseURL(
  value: string | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;
  return stripTrailingSlashes(value) || undefined;
}

/** Browser-style origin, or null if the value is not an http(s) URL. */
export function normalizeOrigin(value: string): string | null {
  const trimmed = stripTrailingSlashes(value);
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
 * Always: Production hosts + loopback.
 * If `BETTER_AUTH_URL` is set: that origin (slash-stripped) too.
 * If unset: grok-sandbox preview wildcards.
 * Optional `BETTER_AUTH_TRUSTED_ORIGINS` adds more.
 */
export function resolveTrustedOrigins(input: TrustedOriginInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const addOrigin = (value: string | undefined) => {
    if (!value) return;
    const origin = normalizeOrigin(value);
    if (origin) {
      pushUnique(out, seen, origin);
      return;
    }
    const stripped = normalizeBaseURL(value);
    if (stripped) pushUnique(out, seen, stripped);
  };

  addOrigin(input.betterAuthUrl);
  for (const origin of PRODUCTION_ORIGINS) addOrigin(origin);

  if (!input.betterAuthUrl) {
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
