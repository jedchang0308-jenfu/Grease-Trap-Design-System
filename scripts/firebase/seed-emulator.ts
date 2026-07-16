import { getAuth } from "firebase-admin/auth";
import { firebaseAdminApp } from "../../src/infrastructure/firebase/admin";

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Refusing to seed Auth without FIREBASE_AUTH_EMULATOR_HOST.");
}

const auth = getAuth(firebaseAdminApp);
const email = process.env.FIREBASE_EMULATOR_USER_EMAIL ?? "engineer@local.test";
const password =
  process.env.FIREBASE_EMULATOR_USER_PASSWORD ?? "local-only-1234";
let user;

try {
  user = await auth.getUserByEmail(email);
} catch {
  user = await auth.createUser({
    email,
    password,
    displayName: "Firebase 本機工程使用者",
    emailVerified: true,
  });
}

await auth.setCustomUserClaims(user.uid, {
  roles: ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"],
});

console.log(`Firebase emulator user ready: ${email}`);
