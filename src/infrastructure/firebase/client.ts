import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

function required(value: string | undefined, name: keyof ImportMetaEnv) {
  if (!value && !useEmulators) {
    throw new Error(`Missing Firebase web config: ${name}`);
  }
  return value || `demo-${String(name).toLowerCase()}`;
}

const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: required(
        import.meta.env.VITE_FIREBASE_API_KEY,
        "VITE_FIREBASE_API_KEY",
      ),
      authDomain: required(
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        "VITE_FIREBASE_AUTH_DOMAIN",
      ),
      projectId: useEmulators
        ? "demo-grease-trap"
        : required(
            import.meta.env.VITE_FIREBASE_PROJECT_ID,
            "VITE_FIREBASE_PROJECT_ID",
          ),
      appId: required(
        import.meta.env.VITE_FIREBASE_APP_ID,
        "VITE_FIREBASE_APP_ID",
      ),
    });

export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);

let emulatorConnected = false;
if (useEmulators && !emulatorConnected) {
  const authEmulatorPort = Number(
    import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT ?? 9099,
  );
  const firestoreEmulatorPort = Number(
    import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080,
  );
  connectAuthEmulator(firebaseAuth, `http://127.0.0.1:${authEmulatorPort}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(firestore, "127.0.0.1", firestoreEmulatorPort);
  emulatorConnected = true;
}

export async function prepareFirebaseAuth() {
  await setPersistence(firebaseAuth, browserLocalPersistence);
  return firebaseAuth;
}
