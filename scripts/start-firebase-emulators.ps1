param(
  [switch]$Test,
  [switch]$E2E
)

$ErrorActionPreference = "Stop"
$projectId = "demo-grease-trap"

function Get-PortListenerSummary([int]$Port) {
  $processIds = @(
    & netstat.exe -ano -p tcp | ForEach-Object {
      if ($_ -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(?<pid>\d+)\s*$") {
        [int]$Matches["pid"]
      }
    } | Sort-Object -Unique
  )

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue |
      Select-Object -First 1
    $processName = if ($process) { $process.ProcessName } else { "unknown process" }
    "${Port} (PID $processId, $processName)"
  }
}

function Get-ExistingProjectEmulators([string]$ProjectId) {
  $locatorPath = Join-Path ([IO.Path]::GetTempPath()) "hub-$ProjectId.json"
  if (-not (Test-Path -LiteralPath $locatorPath)) {
    return $null
  }

  try {
    $locator = Get-Content -Raw -LiteralPath $locatorPath | ConvertFrom-Json
    if (-not $locator.pid -or -not (Get-Process -Id $locator.pid -ErrorAction SilentlyContinue)) {
      return $null
    }

    $hubOrigin = $locator.origins |
      Where-Object { $_ -match '^http://127\.0\.0\.1:\d+$' } |
      Select-Object -First 1
    if (-not $hubOrigin) {
      return $null
    }

    $hub = Invoke-RestMethod -Uri $hubOrigin -TimeoutSec 2
    if ([int]$hub.pid -ne [int]$locator.pid) {
      return $null
    }

    $emulators = Invoke-RestMethod -Uri "$hubOrigin/emulators" -TimeoutSec 2
    $auth = $emulators.auth
    $firestore = $emulators.firestore
    if (-not $auth -or -not $firestore) {
      return $null
    }
    if ($auth.host -notin @("127.0.0.1", "localhost") -or
        $firestore.host -notin @("127.0.0.1", "localhost")) {
      return $null
    }

    return [PSCustomObject]@{
      AuthPort = [int]$auth.port
      FirestorePort = [int]$firestore.port
    }
  } catch {
    return $null
  }
}

function Test-ExistingLocalApp {
  try {
    $response = Invoke-WebRequest `
      -Uri "http://127.0.0.1:3100/cases" `
      -TimeoutSec 2 `
      -UseBasicParsing
    return $response.StatusCode -eq 200 -and
      $response.Content -match '<script type="module" src="/src/main\.tsx"></script>' -and
      $response.Content -match 'href="/jenfu-logo-small\.png"'
  } catch {
    return $false
  }
}

$env:VITE_FIREBASE_API_KEY = "demo-api-key"
$env:VITE_FIREBASE_AUTH_DOMAIN = "demo-grease-trap.firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID = "demo-grease-trap"
$env:VITE_FIREBASE_APP_ID = "demo-app-id"
$env:VITE_USE_FIREBASE_EMULATORS = "true"

if (-not $Test -and -not $E2E) {
  $existingEmulators = Get-ExistingProjectEmulators -ProjectId $projectId
  if ($existingEmulators) {
    if (Test-ExistingLocalApp) {
      Write-Host "Local URL: http://127.0.0.1:3100/cases (existing project runtime)"
      exit 0
    }

    $viteOwner = @(Get-PortListenerSummary -Port 3100)
    if ($viteOwner.Count -gt 0) {
      throw "Port 3100 is occupied by $($viteOwner -join ', '), and it is not serving this project's app. Stop only the verified owner or use its existing URL."
    }

    $env:VITE_FIREBASE_AUTH_EMULATOR_PORT = [string]$existingEmulators.AuthPort
    $env:VITE_FIREBASE_FIRESTORE_EMULATOR_PORT = [string]$existingEmulators.FirestorePort
    Write-Host "Reusing this project's Auth/Firestore emulators on ports $($existingEmulators.AuthPort)/$($existingEmulators.FirestorePort)."
    Write-Host "Local URL: http://127.0.0.1:3100/cases"
    & npx.cmd --no-install vite --host 0.0.0.0 --port 3100 --strictPort
    if ($LASTEXITCODE -ne 0) {
      throw "Vite failed with exit code $LASTEXITCODE"
    }
    exit 0
  }

  $portConflicts = @(
    9099, 8080, 3100 | ForEach-Object { Get-PortListenerSummary -Port $_ }
  )
  if ($portConflicts.Count -gt 0) {
    throw "Cannot start this project's local runtime because a required port is occupied by an unverified process: $($portConflicts -join ', '). No process was stopped."
  }
}

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

$command = if ($Test) {
  "npx vitest run tests/integration"
} elseif ($E2E) {
  "npm run build && npx vite preview --host 127.0.0.1 --port 3210 --strictPort"
} else {
  "npx vite --host 0.0.0.0 --port 3100"
}

& npx.cmd --no-install firebase emulators:exec `
  --project $projectId `
  --only auth,firestore `
  $command

if ($LASTEXITCODE -ne 0) {
  throw "Firebase emulator command failed with exit code $LASTEXITCODE"
}
