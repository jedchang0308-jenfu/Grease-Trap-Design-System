"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";

let auth: Auth | null = null;

export function getFirebaseAuth() {
  if (auth) return auth;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const app = getApps().length
    ? getApp()
    : apiKey
      ? initializeApp({
          apiKey,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId:
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-grease-trap",
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        })
      : initializeApp();
  auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL) {
    connectAuthEmulator(
      auth,
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL,
      { disableWarnings: true },
    );
  }
  return auth;
}

export async function setEphemeralFirebaseAuth(firebaseAuth: Auth) {
  await setPersistence(firebaseAuth, inMemoryPersistence);
}
