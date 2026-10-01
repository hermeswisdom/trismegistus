/** Public origin for Stripe success/cancel URLs — this host, not atmanmusic.app. */
export function resolveCheckoutOrigin(request: Request | undefined): string {
  if (request) {
    const url = new URL(request.url);
    const forwardedHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    if (forwardedHost) {
      const proto =
        forwardedProto || (url.protocol === "https:" ? "https" : "http");
      return `${proto}://${forwardedHost}`;
    }
    return url.origin;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/+$/, "") : `https://${vercel}`;
  }
  const auth = process.env.BETTER_AUTH_URL?.trim();
  if (auth) return auth.replace(/\/+$/, "");
  return "http://localhost:8080";
}

export function checkoutUrls(
  origin: string,
  slug: string,
): { successUrl: string; cancelUrl: string } {
  const base = origin.replace(/\/+$/, "");
  return {
    successUrl: `${base}/download?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/download?cancelled=1&tablet=${encodeURIComponent(slug)}`,
  };
}
