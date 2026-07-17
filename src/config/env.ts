import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ path: ".env.local", quiet: true });
loadDotenv({ path: ".env", quiet: true });

const defaultDataBackend =
  process.env.NODE_ENV === "production"
    ? "firestore"
    : process.env.NODE_ENV === "test"
      ? "memory"
      : "local-file";
const defaultAuthBackend =
  process.env.NODE_ENV === "production" ? "firebase" : "local";
const defaultFirebaseProjectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  "demo-grease-trap";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATA_BACKEND: z
    .enum(["memory", "local-file", "firestore"])
    .default(defaultDataBackend),
  AUTH_BACKEND: z.enum(["local", "firebase"]).default(defaultAuthBackend),
  APP_URL: z.string().url().default("http://localhost:3100"),
  PORT: z.coerce.number().int().positive().default(3100),
  LOCAL_SEED_USER_ID: z.string().min(1).default("local-engineer"),
  LOCAL_SEED_USER_NAME: z.string().min(1).default("本機工程使用者"),
  LOCAL_DATA_FILE: z
    .string()
    .min(1)
    .default("output/local-data/case-store.json"),
  REPORT_OUTPUT_DIR: z.string().min(1).default("output/pdf"),
  FIREBASE_PROJECT_ID: z.string().min(1).default(defaultFirebaseProjectId),
  FIREBASE_STORAGE_BUCKET: z
    .string()
    .min(1)
    .default(`${defaultFirebaseProjectId}.firebasestorage.app`),
  SESSION_COOKIE_NAME: z.string().min(1).default("__session"),
});

export const env = envSchema.parse(process.env);

if (
  env.NODE_ENV === "production" &&
  (env.DATA_BACKEND !== "firestore" || env.AUTH_BACKEND !== "firebase")
) {
  throw new Error(
    "Production requires DATA_BACKEND=firestore and AUTH_BACKEND=firebase.",
  );
}
