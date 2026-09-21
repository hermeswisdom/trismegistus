export type EnvLike = Record<string, string | undefined>;

/**
 * True only when a per-app broker client is injected.
 *
 * The baked `grok_preview` fallback does not count — it only allows
 * `*.grok-sandbox.com` callbacks, so Production must not offer Google / X
 * for it. Broker OAuth buttons return when `GROK_AUTH_CLIENT_ID` and
 * `GROK_AUTH_CLIENT_SECRET` are set on the host.
 */
export function productionGrokAuthConfigured(env: EnvLike): boolean {
  return Boolean(env.GROK_AUTH_CLIENT_ID?.trim() && env.GROK_AUTH_CLIENT_SECRET?.trim());
}
