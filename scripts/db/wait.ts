import { setTimeout as delay } from "node:timers/promises";
import { scriptPool } from "./helpers";

const pool = scriptPool();
let lastError = "unknown";

for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    await pool.query("SELECT 1");
    console.log(`Database ready after ${attempt} attempt(s).`);
    await pool.end();
    process.exit(0);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    await delay(1_000);
  }
}

await pool.end();
throw new Error(`Database did not become ready: ${lastError}`);
