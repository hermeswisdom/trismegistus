import { createServerFn } from "@tanstack/react-start";
import {
  isBotUserAgent,
  isValidVisitorId,
  parseCounts,
  shouldPrune,
  type VisitorCounts,
} from "@/lib/visitor-count";
import { HEARTBEAT_SQL, PRUNE_SQL, READ_SQL } from "@/lib/visitor-sql";

async function requestUserAgent(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return getRequest()?.headers.get("user-agent") ?? null;
  } catch {
    return null;
  }
}

async function pulse(id: string | null): Promise<VisitorCounts | null> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const ua = await requestUserAgent();
    const record = id != null && !isBotUserAgent(ua);
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
