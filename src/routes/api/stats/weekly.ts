import { createFileRoute } from "@tanstack/react-router";
import { handleWeeklyStatsRequest } from "@/lib/weekly-stats";

/**
 * GET /api/stats/weekly — read-only listen_marks rollup for a Mon–Sun week
 * (Europe/London). Bearer STATS_TOKEN. No writes, no cron, no extra services.
 */
export const Route = createFileRoute("/api/stats/weekly")({
  server: {
    handlers: {
      GET: async ({ request }) => handleWeeklyStatsRequest(request),
    },
  },
});
