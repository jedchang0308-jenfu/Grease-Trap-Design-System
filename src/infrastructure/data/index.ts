import { firestore } from "@/infrastructure/firebase/client";
import { FirestoreCaseStore } from "./firestore-case-store";

export const caseStore = new FirestoreCaseStore(firestore);
