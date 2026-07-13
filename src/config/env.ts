import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

const localDatabaseUrl =
  "postgresql://gtc:gtc_local_only@localhost:55432/gtc_dev";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url().default(localDatabaseUrl),
  APP_URL: z.string().url().default("http://localhost:3100"),
  PORT: z.coerce.number().int().positive().default(3100),
  LOCAL_SEED_AUTH: z
    .string()
    .default(process.env.NODE_ENV === "production" ? "false" : "true")
    .transform((value) => value === "true"),
  LOCAL_SEED_USER_ID: z
    .string()
    .uuid()
    .default("00000000-0000-4000-8000-000000000001"),
  LOCAL_SEED_USER_NAME: z.string().min(1).default("本機工程使用者"),
  REPORT_OUTPUT_DIR: z.string().min(1).default("output/pdf"),
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === "production" && env.LOCAL_SEED_AUTH) {
  throw new Error("LOCAL_SEED_AUTH must be disabled in production.");
}
