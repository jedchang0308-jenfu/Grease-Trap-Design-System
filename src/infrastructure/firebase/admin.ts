import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "@/config/env";

export const firebaseAdminApp =
  getApps()[0] ??
  initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });

export const firestore = getFirestore(firebaseAdminApp);

declare global {
  var __gtcFirestoreSettingsApplied: boolean | undefined;
}

if (!globalThis.__gtcFirestoreSettingsApplied) {
  firestore.settings({ ignoreUndefinedProperties: true });
  globalThis.__gtcFirestoreSettingsApplied = true;
}

export const storageBucket = getStorage(firebaseAdminApp).bucket();
