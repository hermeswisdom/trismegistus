import Stripe from "stripe";
import { env } from "./env.server.ts";
import {
  MASTER_CURRENCY,
  MASTER_LICENSE_LINE,
  formatMasterPrice,
  masterPricePence,
} from "./masters.ts";

export type CheckoutLineInput = {
  title: string;
  trackId: string;
  downloadKey: string;
  priceId?: string;
  pence?: number;
};

export function stripeSecretKey(): string | undefined {
  return env("STRIPE_SECRET_KEY");
}

export function stripeWebhookSecret(): string | undefined {
  return env("STRIPE_WEBHOOK_SECRET");
}

export function configuredStripePriceId(): string | undefined {
  return env("STRIPE_PRICE_ID");
}

export function configuredMasterPence(): number {
  return masterPricePence(env("MASTER_PRICE_PENCE"));
}

export function masterCheckoutConfigured(): boolean {
  return Boolean(stripeSecretKey());
}

export function getStripe(): Stripe {
  const key = stripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

export function checkoutLineItems(input: CheckoutLineInput): Stripe.Checkout.SessionCreateParams.LineItem[] {
  if (input.priceId) {
    return [{ price: input.priceId, quantity: 1 }];
  }
  const pence = input.pence ?? configuredMasterPence();
  return [
    {
      quantity: 1,
      price_data: {
        currency: MASTER_CURRENCY,
        unit_amount: pence,
        product_data: {
          name: `${input.title} — master MP3`,
          description: `${MASTER_LICENSE_LINE} · ${formatMasterPrice(pence)}`,
        },
      },
    },
  ];
}

export function checkoutSessionParams(input: {
  originSuccessUrl: string;
  originCancelUrl: string;
  trackId: string;
  downloadKey: string;
  title: string;
  priceId?: string;
  pence?: number;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    billing_address_collection: "auto",
    success_url: input.originSuccessUrl,
    cancel_url: input.originCancelUrl,
    metadata: {
      trackId: input.trackId,
      downloadKey: input.downloadKey,
    },
    payment_intent_data: {
      metadata: {
        trackId: input.trackId,
        downloadKey: input.downloadKey,
      },
    },
    line_items: checkoutLineItems({
      title: input.title,
      trackId: input.trackId,
      downloadKey: input.downloadKey,
      priceId: input.priceId,
      pence: input.pence,
    }),
  };
}

export function parseCheckoutMetadata(
  metadata: Record<string, string> | null | undefined,
): { trackId: string; downloadKey: string } | null {
  const trackId = metadata?.trackId?.trim();
  const downloadKey = metadata?.downloadKey?.trim();
  if (!trackId || !downloadKey) return null;
  return { trackId, downloadKey };
}

export function sessionIsPaid(session: {
  payment_status?: string | null;
  status?: string | null;
}): boolean {
  return session.payment_status === "paid" || session.status === "complete";
}

export function sessionEmail(session: {
  customer_details?: { email?: string | null } | null;
  customer_email?: string | null;
}): string | undefined {
  return session.customer_details?.email ?? session.customer_email ?? undefined;
}

export function verifyStripeWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = stripeWebhookSecret();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
