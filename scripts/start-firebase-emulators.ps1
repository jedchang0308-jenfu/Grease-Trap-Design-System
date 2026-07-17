param(
  [switch]$Test,
  [switch]$E2E
)

$ErrorActionPreference = "Stop"

$javaCommand = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCommand) {
  throw "Firebase Firestore Emulator requires Java 21 or newer. Install a supported JDK, then rerun this command."
}

$javaVersionOutput = & cmd.exe /c "java -version 2>&1" | Out-String
if ($javaVersionOutput -notmatch 'version "([0-9]+)') {
  throw "Unable to detect Java version. Firebase Firestore Emulator requires Java 21 or newer."
}

$javaMajorVersion = [int]$Matches[1]
if ($javaMajorVersion -lt 21) {
  throw "Firebase Firestore Emulator requires Java 21 or newer. Current Java major version is $javaMajorVersion."
}

$env:VITE_FIREBASE_API_KEY = "demo-api-key"
$env:VITE_FIREBASE_AUTH_DOMAIN = "demo-grease-trap.firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID = "demo-grease-trap"
$env:VITE_FIREBASE_APP_ID = "demo-app-id"
$env:VITE_USE_FIREBASE_EMULATORS = "true"

$command = if ($Test) {
  "npx vitest run tests/integration"
} elseif ($E2E) {
  "npm run build && npx vite preview --host 127.0.0.1 --port 3210 --strictPort"
} else {
  "npx vite --host 0.0.0.0 --port 3100"
}

& npx.cmd --no-install firebase emulators:exec `
  --project demo-grease-trap `
  --only auth,firestore `
  $command

if ($LASTEXITCODE -ne 0) {
  throw "Firebase emulator command failed with exit code $LASTEXITCODE"
}
