import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeCase, type CaseRecord } from "@/infrastructure/data/case-store";
import { FirestoreCaseStore } from "@/infrastructure/data/firestore-case-store";

const projectId = "demo-grease-trap";

function record(uid = "anonymous-one"): CaseRecord {
  const now = "2026-07-17T00:00:00.000Z";
  return {
    id: "11111111-1111-4111-8111-111111111111",
    case_group_id: "22222222-2222-4222-8222-222222222222",
    case_no: "GTC-20260717-100001",
    revision_no: 1,
    customer: "共享案件",
    location: "臺灣",
    title: "Rules integration",
    purpose: "驗證匿名共享資料",
    dining_type: null,
    task_code: "T02_DINERS_TO_DESIGN",
    mode: "DUAL_COMPARISON",
    lifecycle_status: "DRAFT",
    calculation_status: null,
    input_payload: {},
    version: 1,
    created_by: uid,
    created_by_name: `訪客 ${uid}`,
    prepared_by: null,
    prepared_by_name: null,
    created_at: now,
    updated_at: now,
    calculations: [],
    assessments: [],
    overrides: [],
    report_draft: null,
  };
}

describe("Firestore rules and browser repository", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: await readFile("firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  beforeEach(async () => environment.clearFirestore());
  afterAll(async () => environment.cleanup());

  it("rejects every unauthenticated case read and write", async () => {
    const database = environment.unauthenticatedContext().firestore();
    const reference = doc(database, "cases", record().case_group_id);
    await assertFails(getDoc(reference));
    await assertFails(setDoc(reference, encodeCase(record())));
  });

  it("allows different anonymous sessions to share a strict case document", async () => {
    const first = environment
      .authenticatedContext("anonymous-one", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore() as unknown as Firestore;
    const second = environment
      .authenticatedContext("anonymous-two", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore() as unknown as Firestore;
    const firstRepository = new FirestoreCaseStore(first);
    const secondRepository = new FirestoreCaseStore(second);

    await assertSucceeds(firstRepository.create(record()));
    expect((await secondRepository.get(record().case_group_id)).title).toBe(
      "Rules integration",
    );

    await assertSucceeds(
      secondRepository.mutate(record().case_group_id, (current) => ({
        next: {
          ...current,
          title: "由另一匿名使用者更新",
          version: current.version + 1,
          updated_at: "2026-07-17T00:01:00.000Z",
        },
        result: null,
      })),
    );
    expect((await firstRepository.get(record().case_group_id)).version).toBe(2);
  });

  it("rejects unknown fields, oversized strings, and skipped versions", async () => {
    const database = environment
      .authenticatedContext("anonymous-one", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore();
    const reference = doc(database, "cases", record().case_group_id);
    const valid = encodeCase(record());

    await assertFails(setDoc(reference, { ...valid, unexpected: true }));
    await assertFails(
      setDoc(reference, { ...valid, customer: "x".repeat(161) }),
    );
    await assertSucceeds(setDoc(reference, valid));
    await assertFails(
      setDoc(reference, { ...valid, version: 3, title: "skip version" }),
    );
  });

  it("denies authenticated access to undeclared collections", async () => {
    const database = environment
      .authenticatedContext("anonymous-one", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore();
    await assertFails(
      setDoc(doc(database, "reports", "unknown"), { ok: true }),
    );
  });

  it("cannot forge or mutate a legacy workflow status", async () => {
    const database = environment
      .authenticatedContext("anonymous-one", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore();
    const reference = doc(database, "cases", record().case_group_id);
    const active = encodeCase(record());
    await assertSucceeds(setDoc(reference, active));
    await assertFails(
      setDoc(reference, {
        ...active,
        lifecycleStatus: "ISSUED",
        version: 2,
      }),
    );

    const legacy = { ...active, lifecycleStatus: "ISSUED", version: 9 };
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "cases", record().case_group_id),
        legacy,
      );
    });
    await assertFails(
      setDoc(reference, { ...legacy, title: "mutated history", version: 10 }),
    );
    await assertFails(deleteDoc(reference));
  });
});
