import { env } from "@/config/env";
import type { CaseStore } from "./case-store";
import { MemoryCaseStore } from "./memory-case-store";

declare global {
  var __gtcCaseStore: CaseStore | undefined;
}

async function createStore(): Promise<CaseStore> {
  if (env.DATA_BACKEND === "firestore") {
    const { FirestoreCaseStore } = await import("./firestore-case-store");
    return new FirestoreCaseStore();
  }
  return new MemoryCaseStore();
}

export const caseStore = globalThis.__gtcCaseStore ?? (await createStore());

if (env.NODE_ENV !== "production") globalThis.__gtcCaseStore = caseStore;
