import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStripeWebhook } = await import("@/lib/downloads.server");
        const raw = await request.text();
        const signature = request.headers.get("stripe-signature");
        const result = await handleStripeWebhook(raw, signature);
        if (!result.ok) {
          return new Response(result.message, { status: result.status });
        }
        return Response.json({ received: true });
      },
    },
  },
});
