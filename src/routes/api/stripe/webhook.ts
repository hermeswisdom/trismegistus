import { createFileRoute } from "@tanstack/react-router";
import { parseCheckoutMetadata, sessionEmail, sessionIsPaid } from "@/lib/stripe-master";
import { saleKeyForTrackId, upsertPaidPurchase } from "@/lib/purchases";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return Response.json({ error: "Missing stripe-signature" }, { status: 400 });
        }
        const rawBody = await request.text();
        let event;
        try {
          const { verifyStripeWebhook } = await import("@/lib/stripe-master");
          event = verifyStripeWebhook(rawBody, signature);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid signature";
          return Response.json({ error: message }, { status: 400 });
        }

        if (
          event.type !== "checkout.session.completed" &&
          event.type !== "checkout.session.async_payment_succeeded"
        ) {
          return Response.json({ received: true, ignored: event.type });
        }

        const session = event.data.object;
        if (!sessionIsPaid(session) && event.type === "checkout.session.completed") {
          return Response.json({ received: true, unpaid: true });
        }
        const meta = parseCheckoutMetadata(session.metadata);
        if (!meta) {
          return Response.json({ received: true, missing: "metadata" });
        }
        const expected = saleKeyForTrackId(meta.trackId);
        if (!expected || expected !== meta.downloadKey) {
          return Response.json({ received: true, unknown: meta.trackId }, { status: 202 });
        }
        try {
          await upsertPaidPurchase({
            sessionId: session.id,
            trackId: meta.trackId,
            downloadKey: meta.downloadKey,
            email: sessionEmail(session),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "fulfillment failed";
          return Response.json({ error: message }, { status: 500 });
        }
        return Response.json({ received: true, fulfilled: session.id });
      },
    },
  },
});
