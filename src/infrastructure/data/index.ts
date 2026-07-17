import { env } from "@/config/env";
import type { CaseStore } from "./case-store";
import { MemoryCaseStore } from "./memory-case-store";

interface CachedCaseStore {
  key: string;
  store: CaseStore;
}

declare global {
  var __gtcCaseStore: CachedCaseStore | CaseStore | undefined;
}

const caseStoreCacheKey = [
  env.NODE_ENV,
  env.DATA_BACKEND,
  env.DATA_BACKEND === "local-file" ? env.LOCAL_DATA_FILE : "",
].join(":");

function isCachedCaseStore(value: unknown): value is CachedCaseStore {
  return (
    !!value && typeof value === "object" && "key" in value && "store" in value
  );
}

async function createStore(): Promise<CaseStore> {
  if (env.DATA_BACKEND === "firestore") {
    const { FirestoreCaseStore } = await import("./firestore-case-store");
    return new FirestoreCaseStore();
  }
  if (env.DATA_BACKEND === "local-file") {
    const { LocalFileCaseStore } = await import("./local-file-case-store");
    return new LocalFileCaseStore(env.LOCAL_DATA_FILE);
  }
  return new MemoryCaseStore();
}

const cachedCaseStore = isCachedCaseStore(globalThis.__gtcCaseStore)
  ? globalThis.__gtcCaseStore
  : undefined;

export const caseStore =
  cachedCaseStore?.key === caseStoreCacheKey
    ? cachedCaseStore.store
    : await createStore();

if (env.NODE_ENV !== "production") {
  globalThis.__gtcCaseStore = { key: caseStoreCacheKey, store: caseStore };
}
