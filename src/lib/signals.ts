import { createServerFn } from "@tanstack/react-start";

export type SignalNote = {
  id: number;
  author: string;
  body: string;
  createdAt: string;
};

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

async function readSignals(): Promise<SignalNote[]> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    return sql<SignalNote>`
      select
        id,
        author,
        body,
        created_at::text as "createdAt"
      from signals
      order by created_at desc
      limit 40
    `;
  } catch {
    return [];
  }
}

export const listSignals = createServerFn({ method: "GET" }).handler(
  async () => readSignals(),
);

export const addSignal = createServerFn({ method: "POST" })
  .validator((input: { author: string; body: string }) => ({
    author: clean(input.author, 40),
    body: clean(input.body, 480),
  }))
  .handler(async ({ data }) => {
    if (!data.author || !data.body) return readSignals();
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        insert into signals (author, body)
        values (${data.author}, ${data.body})
      `;
    } catch {
      /* page still serves if the store is down */
    }
    return readSignals();
  });
