import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "@/config/env";

declare global {
  var __gtcPool: Pool | undefined;
}

export const pool =
  globalThis.__gtcPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === "test" ? 4 : 10,
  });

if (env.NODE_ENV !== "production") {
  globalThis.__gtcPool = pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return pool.query<T>(text, values);
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
