import { env } from "@/config/env";
import type { AuthPort } from "./auth-port";
import { LocalSeedAuthAdapter } from "./local-auth";

async function createAuthPort(): Promise<AuthPort> {
  if (env.AUTH_BACKEND === "firebase") {
    const { FirebaseAuthAdapter } = await import("./firebase-auth");
    return new FirebaseAuthAdapter();
  }
  return new LocalSeedAuthAdapter();
}

export const authPort = await createAuthPort();
