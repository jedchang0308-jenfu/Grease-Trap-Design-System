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
const firestorePort = Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8080);

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
        port: firestorePort,
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

  it("accepts volume-to-flow only with the legacy calculation mode", async () => {
    const database = environment
      .authenticatedContext("anonymous-one", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore();
    const validRecord: CaseRecord = {
      ...record(),
      task_code: "T06_EFFECTIVE_VOLUME_TO_FLOW",
      mode: "LEGACY_QV",
    };
    const invalidRecord: CaseRecord = {
      ...validRecord,
      id: "33333333-3333-4333-8333-333333333333",
      case_group_id: "44444444-4444-4444-8444-444444444444",
      mode: "CURRENT_QG",
    };

    await assertSucceeds(
      setDoc(
        doc(database, "cases", validRecord.case_group_id),
        encodeCase(validRecord),
      ),
    );
    await assertFails(
      setDoc(
        doc(database, "cases", invalidRecord.case_group_id),
        encodeCase(invalidRecord),
      ),
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

  it("archives revisions atomically and allows resumable deletion", async () => {
    const database = environment
      .authenticatedContext("anonymous-one", {
        firebase: { sign_in_provider: "anonymous" },
      })
      .firestore() as unknown as Firestore;
    const current = {
      ...record(),
      id: "55555555-5555-4555-8555-555555555555",
      case_group_id: "66666666-6666-4666-8666-666666666666",
    };
    const store = new FirestoreCaseStore(database);
    await assertSucceeds(store.create(current));
    await assertSucceeds(
      store.mutate(current.case_group_id, (item) => ({
        next: {
          ...item,
          lifecycle_status: "REPORT_DRAFT",
          version: item.version + 1,
          updated_at: "2026-07-17T00:00:30.000Z",
        },
        result: null,
      })),
    );

    await assertSucceeds(
      store.archiveCurrentAndMutate(current.case_group_id, 2, (item) => ({
        next: {
          ...item,
          id: "77777777-7777-4777-8777-777777777777",
          revision_no: item.revision_no + 1,
          version: item.version + 1,
          lifecycle_status: "DRAFT",
          calculation_status: null,
          title: "第二版",
          updated_at: "2026-07-17T00:01:00.000Z",
        },
        result: null,
      })),
    );

    const revisions = await store.listRevisions(current.case_group_id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].revision_no).toBe(1);
    expect((await store.get(current.case_group_id)).revision_no).toBe(2);

    const revisionReference = doc(
      database,
      "cases",
      current.case_group_id,
      "revisions",
      current.id,
    );
    await assertFails(
      setDoc(revisionReference, {
        ...encodeCase(current),
        title: "不可變更歷史",
      }),
    );

    await assertSucceeds(store.beginDelete(current.case_group_id, 3));
    await assertSucceeds(getDoc(revisionReference));
    await assertSucceeds(deleteDoc(revisionReference));
    await assertSucceeds(store.finishDelete(current.case_group_id));
    await expect(store.get(current.case_group_id)).rejects.toThrow(
      "找不到這筆共享案件",
    );
  });
});
