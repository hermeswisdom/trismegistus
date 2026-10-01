import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkoutUrls, resolveCheckoutOrigin } from "./checkout-origin.ts";
import {
  checkoutLineItems,
  checkoutSessionParams,
  parseCheckoutMetadata,
  sessionEmail,
  sessionIsPaid,
} from "./stripe-master.ts";

describe("checkout line items", () => {
  it("defaults to 99 pence GBP price_data when no Price ID is set", () => {
    const items = checkoutLineItems({
      title: "The Sleepers Waking",
      trackId: "the-sleepers-waking",
      downloadKey: "masters/the-sleepers-waking.mp3",
      pence: 99,
    });
    const price = items[0]?.price_data;
    assert.equal(items[0]?.price, undefined);
    assert.equal(price?.currency, "gbp");
    assert.equal(price?.unit_amount, 99);
    assert.match(String(price?.product_data?.description), /personal use/);
  });

  it("uses a configured Stripe Price ID when present", () => {
    const items = checkoutLineItems({
      title: "The Sleepers Waking",
      trackId: "the-sleepers-waking",
      downloadKey: "masters/the-sleepers-waking.mp3",
      priceId: "price_test_99",
    });
    assert.deepEqual(items, [{ price: "price_test_99", quantity: 1 }]);
  });
});

describe("checkout session params", () => {
  it("writes track id onto the session for the webhook", () => {
    const params = checkoutSessionParams({
      originSuccessUrl: "https://preview.test/download?session_id={CHECKOUT_SESSION_ID}",
      originCancelUrl: "https://preview.test/download?cancelled=1&tablet=the-sleepers-waking",
      trackId: "the-sleepers-waking",
      downloadKey: "masters/the-sleepers-waking.mp3",
      title: "The Sleepers Waking",
      pence: 99,
    });
    assert.equal(params.mode, "payment");
    assert.equal(params.metadata?.trackId, "the-sleepers-waking");
    assert.equal(params.metadata?.downloadKey, "masters/the-sleepers-waking.mp3");
    assert.equal(params.payment_intent_data?.metadata?.trackId, "the-sleepers-waking");
    assert.match(String(params.success_url), /CHECKOUT_SESSION_ID/);
  });
});

describe("webhook helpers", () => {
  it("reads paid email and metadata", () => {
    assert.deepEqual(
      parseCheckoutMetadata({
        trackId: "the-sleepers-waking",
        downloadKey: "masters/the-sleepers-waking.mp3",
      }),
      {
        trackId: "the-sleepers-waking",
        downloadKey: "masters/the-sleepers-waking.mp3",
      },
    );
    assert.equal(parseCheckoutMetadata({}), null);
    assert.equal(
      sessionIsPaid({ payment_status: "paid", status: "complete" }),
      true,
    );
    assert.equal(
      sessionIsPaid({ payment_status: "unpaid", status: "open" }),
      false,
    );
    assert.equal(
      sessionEmail({
        customer_email: null,
        customer_details: { email: "atman@example.test" },
      }),
      "atman@example.test",
    );
  });
});

describe("checkout origin", () => {
  it("prefers the forwarded preview host over atmanmusic.app", () => {
    const request = new Request("http://127.0.0.1/api/x", {
      headers: {
        "x-forwarded-host": "trismegistus-git-hold.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    const origin = resolveCheckoutOrigin(request);
    assert.equal(origin, "https://trismegistus-git-hold.vercel.app");
    const urls = checkoutUrls(origin, "the-sleepers-waking");
    assert.equal(
      urls.successUrl,
      "https://trismegistus-git-hold.vercel.app/download?session_id={CHECKOUT_SESSION_ID}",
    );
    assert.match(urls.cancelUrl, /cancelled=1/);
    assert.equal(origin.includes("atmanmusic.app"), false);
  });
});
