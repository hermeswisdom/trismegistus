import { createServerFn } from "@tanstack/react-start";
import { checkoutUrls, resolveCheckoutOrigin } from "@/lib/checkout-origin";
import { MASTER_LICENSE_LINE, isDryRunSessionId } from "@/lib/masters";
import {
  ensureDryRunPurchase,
  findPurchaseByReceipt,
  findPurchaseBySession,
  masterDryRunEnabled,
  newDryRunCheckout,
  saleKeyForTrackId,
  trackForCheckout,
  upsertPaidPurchase,
  type RedeemErr,
  type RedeemOk,
} from "@/lib/purchases";

export type CheckoutStart =
  | { ok: true; url: string; dryRun?: boolean }
  | { ok: false; error: string };

export type RedeemInput = {
  sessionId?: string;
  receipt?: string;
};

async function requestOrigin(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return resolveCheckoutOrigin(getRequest());
  } catch {
    return resolveCheckoutOrigin(undefined);
  }
}

async function grantFromPurchase(
  sessionId: string | undefined,
  receipt: string | undefined,
  origin: string,
): Promise<RedeemOk | RedeemErr> {
  const { grantFromExisting } = await import("@/lib/purchase-grant");
  if (receipt) {
    const row = await findPurchaseByReceipt(receipt);
    if (!row) return { ok: false, error: "That receipt was not found." };
    return grantFromExisting(row, origin);
  }
  if (!sessionId) {
    return { ok: false, error: "Add a Stripe session or receipt token." };
  }
  const existing = await findPurchaseBySession(sessionId);
  if (existing) return grantFromExisting(existing, origin);

  if (isDryRunSessionId(sessionId)) {
    if (!masterDryRunEnabled()) {
      return { ok: false, error: "Dry-run checkout is off. Set MASTER_DRY_RUN=1." };
    }
    const row = await ensureDryRunPurchase(sessionId);
    if (!row) return { ok: false, error: "Dry-run session does not match a sale track." };
    return grantFromExisting(row, origin);
  }

  const { getStripe, parseCheckoutMetadata, sessionEmail, sessionIsPaid } =
    await import("@/lib/stripe-master");
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (!sessionIsPaid(session)) {
      return { ok: false, error: "Payment is not complete yet." };
    }
    const meta = parseCheckoutMetadata(session.metadata);
    if (!meta) return { ok: false, error: "This session is missing track metadata." };
    const expected = saleKeyForTrackId(meta.trackId);
    if (!expected || expected !== meta.downloadKey) {
      return { ok: false, error: "This session is not a master purchase." };
    }
    const row = await upsertPaidPurchase({
      sessionId: session.id,
      trackId: meta.trackId,
      downloadKey: meta.downloadKey,
      email: sessionEmail(session),
    });
    if (!row) return { ok: false, error: "Could not store the receipt. Check DATABASE_URL." };
    return grantFromExisting(row, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe lookup failed.";
    return { ok: false, error: message };
  }
}

export const startMasterCheckout = createServerFn({ method: "POST" })
  .validator((input: { trackId: string }) => ({
    trackId: typeof input.trackId === "string" ? input.trackId : "",
  }))
  .handler(async ({ data }): Promise<CheckoutStart> => {
    const mapped = trackForCheckout(data.trackId);
    if (!mapped) {
      return { ok: false, error: "No master is for sale on this tablet yet." };
    }
    const origin = await requestOrigin();
    const urls = checkoutUrls(origin, mapped.track.slug);
    const { masterCheckoutConfigured, checkoutSessionParams, configuredStripePriceId, getStripe } =
      await import("@/lib/stripe-master");

    if (!masterCheckoutConfigured()) {
      if (!masterDryRunEnabled()) {
        return {
          ok: false,
          error:
            "Stripe is not configured. Set STRIPE_SECRET_KEY (test mode) or MASTER_DRY_RUN=1. See README.",
        };
      }
      const sessionId = newDryRunCheckout(mapped.track.id);
      await ensureDryRunPurchase(sessionId);
      return {
        ok: true,
        dryRun: true,
        url: `${origin.replace(/\/+$/, "")}/download?session_id=${encodeURIComponent(sessionId)}`,
      };
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create(
        checkoutSessionParams({
          originSuccessUrl: urls.successUrl,
          originCancelUrl: urls.cancelUrl,
          trackId: mapped.track.id,
          downloadKey: mapped.downloadKey,
          title: mapped.track.title,
          priceId: configuredStripePriceId(),
        }),
      );
      if (!session.url) {
        return { ok: false, error: "Stripe did not return a checkout URL." };
      }
      return { ok: true, url: session.url };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed.";
      return { ok: false, error: message };
    }
  });

export const redeemMasterPurchase = createServerFn({ method: "POST" })
  .validator((input: RedeemInput) => ({
    sessionId: typeof input.sessionId === "string" ? input.sessionId.trim() : undefined,
    receipt: typeof input.receipt === "string" ? input.receipt.trim() : undefined,
  }))
  .handler(async ({ data }): Promise<RedeemOk | RedeemErr> => {
    const origin = await requestOrigin();
    return grantFromPurchase(data.sessionId, data.receipt, origin);
  });

export const masterLicenseLine = MASTER_LICENSE_LINE;
