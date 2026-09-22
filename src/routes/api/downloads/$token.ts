import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/downloads/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { streamPurchasedMaster } = await import("@/lib/downloads.server");
        return streamPurchasedMaster(params.token);
      },
    },
  },
});
