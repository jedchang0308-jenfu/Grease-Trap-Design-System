import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { AppProblem } from "@/application/problem";
import {
  decodeCase,
  encodeCase,
  type CaseMutator,
  type CaseRecord,
  type CaseStore,
} from "./case-store";

const activeLifecycles = new Set([
  "DRAFT",
  "INPUT_READY",
  "CALCULATED",
  "REPORT_DRAFT",
]);

const deletingLifecycle = "DELETING";

function notFound() {
  return new AppProblem({
    code: "CASE_NOT_FOUND",
    title: "找不到案件",
    userMessage: "找不到這筆共享案件，請返回案件清單。",
    retryable: false,
  });
}

export class FirestoreCaseStore implements CaseStore {
  constructor(private readonly database: Firestore) {}

  private caseRef(caseGroupId: string) {
    return doc(this.database, "cases", caseGroupId);
  }

  private revisionsRef(caseGroupId: string) {
    return collection(this.database, "cases", caseGroupId, "revisions");
  }

  private revisionRef(caseGroupId: string, recordId: string) {
    return doc(this.revisionsRef(caseGroupId), recordId);
  }

  async create(record: CaseRecord) {
    return runTransaction(this.database, async (transaction) => {
      const reference = this.caseRef(record.case_group_id);
      const existing = await transaction.get(reference);
      if (existing.exists()) {
        throw new AppProblem({
          code: "CASE_ALREADY_EXISTS",
          title: "案件識別碼已存在",
          userMessage: "請重新建立案件。",
          retryable: true,
        });
      }
      transaction.set(reference, encodeCase(record));
      return structuredClone(record);
    });
  }

  async list() {
    const snapshot = await getDocs(
      query(collection(this.database, "cases"), orderBy("updatedAt", "desc")),
    );
    return snapshot.docs.map((item) => decodeCase(item.data()));
  }

  async get(caseGroupId: string) {
    const snapshot = await getDoc(this.caseRef(caseGroupId));
    if (!snapshot.exists()) throw notFound();
    return decodeCase(snapshot.data());
  }

  async mutate<T>(caseGroupId: string, mutator: CaseMutator<T>) {
    return runTransaction(this.database, async (transaction) => {
      const reference = this.caseRef(caseGroupId);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw notFound();
      const current = decodeCase(snapshot.data());
      const mutation = mutator(structuredClone(current));
      if (mutation.next.version !== current.version + 1) {
        throw new Error("Case mutation must increment version exactly once");
      }
      transaction.set(reference, encodeCase(mutation.next));
      return structuredClone(mutation.result);
    });
  }

  async archiveCurrentAndMutate<T>(
    caseGroupId: string,
    expectedVersion: number,
    mutator: CaseMutator<T>,
  ) {
    return runTransaction(this.database, async (transaction) => {
      const currentReference = this.caseRef(caseGroupId);
      const currentSnapshot = await transaction.get(currentReference);
      if (!currentSnapshot.exists()) throw notFound();
      const current = decodeCase(currentSnapshot.data());
      if (current.version !== expectedVersion) {
        throw new AppProblem({
          code: "STALE_CASE_VERSION",
          title: "共享案件已有新版本",
          userMessage: "請重新載入後再建立版本。",
          retryable: true,
        });
      }
      const archiveReference = this.revisionRef(caseGroupId, current.id);
      const archiveSnapshot = await transaction.get(archiveReference);
      if (archiveSnapshot.exists()) {
        throw new AppProblem({
          code: "REVISION_ARCHIVE_ALREADY_EXISTS",
          title: "歷史版本已存在",
          userMessage: "這個版本已經保存，請重新載入案件後再試。",
          retryable: true,
        });
      }
      if (!activeLifecycles.has(current.lifecycle_status)) {
        throw new AppProblem({
          code: "CASE_NOT_EDITABLE",
          title: "目前案件不可建立新版本",
          userMessage: "目前案件狀態不允許建立新版本。",
          retryable: false,
        });
      }
      const mutation = mutator(structuredClone(current));
      if (
        mutation.next.version !== current.version + 1 ||
        mutation.next.revision_no !== current.revision_no + 1 ||
        mutation.next.case_group_id !== caseGroupId ||
        mutation.next.id === current.id
      ) {
        throw new Error(
          "Revision mutation must increment identity and version exactly once",
        );
      }
      transaction.set(archiveReference, encodeCase(current));
      transaction.set(currentReference, encodeCase(mutation.next));
      return structuredClone(mutation.result);
    });
  }

  async listRevisions(caseGroupId: string) {
    const snapshot = await getDocs(
      query(this.revisionsRef(caseGroupId), orderBy("revisionNo", "desc")),
    );
    return snapshot.docs.map((item) => decodeCase(item.data()));
  }

  async getRevision(caseGroupId: string, revisionNo: number) {
    const snapshot = await getDocs(
      query(
        this.revisionsRef(caseGroupId),
        where("revisionNo", "==", revisionNo),
        limit(2),
      ),
    );
    if (snapshot.empty) throw notFound();
    if (snapshot.size > 1) {
      throw new AppProblem({
        code: "REVISION_DATA_CONFLICT",
        title: "歷史版本資料衝突",
        userMessage: "找到重複的歷史版本，請通知管理者檢查資料。",
        retryable: false,
      });
    }
    return decodeCase(snapshot.docs[0].data());
  }

  async beginDelete(caseGroupId: string, expectedVersion: number) {
    return runTransaction(this.database, async (transaction) => {
      const reference = this.caseRef(caseGroupId);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) throw notFound();
      const current = decodeCase(snapshot.data());
      if (current.lifecycle_status === deletingLifecycle) return current;
      if (current.version !== expectedVersion) {
        throw new AppProblem({
          code: "STALE_CASE_VERSION",
          title: "共享案件已有新版本",
          userMessage: "請重新載入後再刪除案件。",
          retryable: true,
        });
      }
      if (!activeLifecycles.has(current.lifecycle_status)) {
        throw new AppProblem({
          code: "CASE_NOT_DELETABLE",
          title: "目前案件不可刪除",
          userMessage: "舊系統歷史資料目前僅供查閱，無法由此流程刪除。",
          retryable: false,
        });
      }
      const next = {
        ...current,
        lifecycle_status: deletingLifecycle,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
      };
      transaction.set(reference, encodeCase(next));
      return structuredClone(next);
    });
  }

  async purgeRevisions(caseGroupId: string) {
    const snapshot = await getDocs(
      query(
        this.revisionsRef(caseGroupId),
        orderBy("revisionNo", "desc"),
        limit(10),
      ),
    );
    if (snapshot.empty) return 0;
    const batch = writeBatch(this.database);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    return snapshot.size;
  }

  async finishDelete(caseGroupId: string) {
    const remaining = await getDocs(
      query(this.revisionsRef(caseGroupId), limit(1)),
    );
    if (!remaining.empty) {
      throw new AppProblem({
        code: "CASE_HISTORY_REMAINS",
        title: "歷史版本尚未清除",
        userMessage: "仍有歷史版本待清除，請繼續刪除。",
        retryable: true,
      });
    }
    await runTransaction(this.database, async (transaction) => {
      const reference = this.caseRef(caseGroupId);
      const currentSnapshot = await transaction.get(reference);
      if (!currentSnapshot.exists()) return;
      const current = decodeCase(currentSnapshot.data());
      if (current.lifecycle_status !== deletingLifecycle) {
        throw new AppProblem({
          code: "CASE_DELETE_NOT_STARTED",
          title: "案件尚未進入刪除流程",
          userMessage: "請先開始刪除流程，再確認案件已清除。",
          retryable: true,
        });
      }
      transaction.delete(reference);
    });
    const confirmation = await getDoc(this.caseRef(caseGroupId));
    if (confirmation.exists()) {
      throw new AppProblem({
        code: "CASE_DELETE_UNCONFIRMED",
        title: "案件刪除尚未確認",
        userMessage: "案件尚未完全刪除，請重新整理後再試。",
        retryable: true,
      });
    }
  }

  async delete(caseGroupId: string) {
    await deleteDoc(this.caseRef(caseGroupId));
  }
}
