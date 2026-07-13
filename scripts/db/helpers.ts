import { config as loadDotenv } from "dotenv";
import { Pool } from "pg";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

export const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://gtc:gtc_local_only@localhost:55432/gtc_dev";

export function scriptPool() {
  return new Pool({ connectionString: databaseUrl, max: 2 });
}
