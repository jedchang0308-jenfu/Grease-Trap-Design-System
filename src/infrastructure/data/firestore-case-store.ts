import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
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

  async delete(caseGroupId: string) {
    await deleteDoc(this.caseRef(caseGroupId));
  }
}
