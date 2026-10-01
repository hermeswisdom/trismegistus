import { createServerFn } from "@tanstack/react-start";
import {
  isBotUserAgent,
  isValidVisitorId,
  parseCounts,
  shouldPrune,
  type VisitorCounts,
} from "@/lib/visitor-count";
import { shouldCountRequest } from "@/lib/qc-traffic";
import { HEARTBEAT_SQL, PRUNE_SQL, READ_SQL } from "@/lib/visitor-sql";

/** Returns the UA and whether this request may write presence counts. */
async function requestContext(): Promise<{ ua: string | null; count: boolean }> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest() ?? null;
    return {
      ua: request?.headers.get("user-agent") ?? null,
      count: shouldCountRequest(request, process.env.VERCEL_ENV),
    };
  } catch {
    return { ua: null, count: false };
  }
}

async function pulse(id: string | null): Promise<VisitorCounts | null> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const { ua, count } = await requestContext();
    // Preview deploys, QC runs and bots only read the counts.
    const record = id != null && count && !isBotUserAgent(ua);
    const rows = record
      ? await sql.query(HEARTBEAT_SQL, [id])
      : await sql.query(READ_SQL);
    if (record && shouldPrune()) {
      try {
        await sql.query(PRUNE_SQL);
      } catch {
        /* next heartbeat retries */
      }
    }
    return parseCounts(rows[0]);
  } catch {
    // No DB / table missing: the badge hides, the page keeps working.
    return null;
  }
}

/** Heartbeat from the badge. Returns null when the store is unavailable. */
export const visitorHeartbeat = createServerFn({ method: "POST" })
  .validator((input: { id?: unknown } | undefined) => {
    const id = input?.id;
    return { id: isValidVisitorId(id) ? id : null };
  })
  .handler(async ({ data }) => pulse(data.id));
