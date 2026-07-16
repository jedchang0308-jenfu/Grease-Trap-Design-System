param(
  [switch]$Test
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Firebase Firestore Emulator requires Java. Install a supported JDK, then rerun npm run dev:firebase. npm run dev:local does not require Java."
}

$env:DATA_BACKEND = "firestore"
$env:AUTH_BACKEND = "firebase"
$env:FIREBASE_PROJECT_ID = "demo-grease-trap"
$env:FIREBASE_STORAGE_BUCKET = "demo-grease-trap.firebasestorage.app"
$env:NEXT_PUBLIC_FIREBASE_API_KEY = "demo-api-key"
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo-grease-trap.firebaseapp.com"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-grease-trap"
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo-grease-trap.firebasestorage.app"
$env:NEXT_PUBLIC_FIREBASE_APP_ID = "demo-app-id"
$env:NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = "http://127.0.0.1:9099"

$command = if ($Test) {
  "npm run firebase:seed && npm run test:integration"
} else {
  "npm run firebase:seed && npm run dev:server"
}

& npx.cmd --no-install firebase emulators:exec `
  --project demo-grease-trap `
  --only auth,firestore,storage `
  $command

if ($LASTEXITCODE -ne 0) {
  throw "Firebase emulator command failed with exit code $LASTEXITCODE"
}
