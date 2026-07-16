import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { databaseUrl } from "./db/helpers";

const port = Number(process.env.PORT ?? 3100);
const url = `http://localhost:${port}`;
const prepareOnly = process.argv.includes("--prepare-only");
const defaultPostgresPort = Number(process.env.POSTGRES_PORT ?? 55433);
const defaultDockerDatabaseUrl = `postgresql://gtc:gtc_local_only@localhost:${defaultPostgresPort}/gtc_dev`;
const managedPostgresRoot =
  process.env.GTC_LOCAL_PG_ROOT ??
  (process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "GreaseTrapDesignSystem")
    : path.resolve("tmp", "GreaseTrapDesignSystem"));
const managedPostgresDataDir =
  process.env.GTC_LOCAL_PGDATA ??
  path.join(managedPostgresRoot, "postgres-data-18");
const managedPostgresLogPath = path.join(
  managedPostgresRoot,
  "logs",
  `postgres-${defaultPostgresPort}.log`,
);

function describeDatabaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "configured DATABASE_URL";
  }
}

async function databaseIsReachable(connectionString: string) {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 1_500,
    max: 1,
  });
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

function commandExists(command: string) {
  const result = spawnSync(command, ["--version"], {
    shell: true,
    stdio: "ignore",
  });
  return result.status === 0;
}

function runCommand(command: string, args: string[]) {
  return (
    spawnSync(command, args, {
      stdio: "inherit",
    }).status === 0
  );
}

function ensureDockerReady() {
  const result = spawnSync("docker", ["info"], {
    shell: true,
    encoding: "utf8",
  });
  if (result.status === 0) return;

  const detail = [result.stdout, result.stderr].filter(Boolean).join("\n");
  console.error("");
  console.error(
    "Docker Desktop is not running, so the default local PostgreSQL cannot start.",
  );
  console.error("");
  console.error("Next step:");
  console.error(
    "Option A: Open Docker Desktop, wait until it says Docker is running, then re-run: npm run dev:local",
  );
  console.error(
    "Option B: Start your own PostgreSQL and set DATABASE_URL in .env.local, then re-run: npm run dev:local",
  );
  console.error("");
  console.error("Windows PowerShell shortcut:");
  console.error(
    'Start-Process "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"',
  );
  console.error("");
  console.error("Default DATABASE_URL:");
  console.error(describeDatabaseUrl(defaultDockerDatabaseUrl));
  if (detail.trim()) {
    console.error("");
    console.error("Docker diagnostic:");
    console.error(detail.trim());
  }
  process.exit(result.status ?? 1);
}

async function ensureManagedDatabaseExists() {
  const pool = new Pool({
    connectionString: `postgresql://gtc@localhost:${defaultPostgresPort}/postgres`,
    connectionTimeoutMillis: 2_000,
    max: 1,
  });
  try {
    const exists = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ["gtc_dev"],
    );
    if (!exists.rowCount) await pool.query("CREATE DATABASE gtc_dev");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function startManagedLocalPostgres() {
  if (!commandExists("pg_ctl") || !commandExists("initdb")) return false;

  mkdirSync(path.dirname(managedPostgresDataDir), { recursive: true });
  mkdirSync(path.dirname(managedPostgresLogPath), { recursive: true });

  if (!existsSync(path.join(managedPostgresDataDir, "PG_VERSION"))) {
    console.log(
      `Initializing local PostgreSQL data directory: ${managedPostgresDataDir}`,
    );
    const initialized = runCommand("initdb", [
      "-D",
      managedPostgresDataDir,
      "-U",
      "gtc",
      "-A",
      "trust",
      "--encoding=UTF8",
    ]);
    if (!initialized) return false;
  }

  const status = spawnSync("pg_ctl", ["-D", managedPostgresDataDir, "status"], {
    stdio: "ignore",
  });

  if (status.status !== 0) {
    console.log(
      `Starting local PostgreSQL without Docker: ${managedPostgresDataDir}`,
    );
    const started = runCommand("pg_ctl", [
      "-D",
      managedPostgresDataDir,
      "-o",
      `-p ${defaultPostgresPort}`,
      "-l",
      managedPostgresLogPath,
      "start",
    ]);
    if (!started) return false;
  }

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    if (
      await databaseIsReachable(
        `postgresql://gtc@localhost:${defaultPostgresPort}/postgres`,
      )
    ) {
      await ensureManagedDatabaseExists();
      console.log("Using managed local PostgreSQL without Docker.");
      return true;
    }
    await delay(1_000);
  }

  return false;
}

async function selectDatabaseStartupCommands() {
  const reachable = await databaseIsReachable(databaseUrl);
  if (reachable) {
    console.log(
      `Using existing PostgreSQL: ${describeDatabaseUrl(databaseUrl)}`,
    );
    console.log("Skipping docker compose db startup.");
    return ["db:migrate", "db:seed", "db:verify"];
  }

  if (databaseUrl !== defaultDockerDatabaseUrl) {
    console.error("");
    console.error("Configured DATABASE_URL is not reachable.");
    console.error(describeDatabaseUrl(databaseUrl));
    console.error("");
    console.error("Next step:");
    console.error(
      "1. Start that PostgreSQL server, or update DATABASE_URL in .env.local.",
    );
    console.error("2. Re-run: npm run dev:local");
    console.error("");
    console.error(
      "Docker fallback was not used because DATABASE_URL points to a custom database.",
    );
    process.exit(1);
  }

  const managedLocalStarted = await startManagedLocalPostgres();
  if (managedLocalStarted) return ["db:migrate", "db:seed", "db:verify"];

  ensureDockerReady();
  return ["db:up", "db:wait", "db:migrate", "db:seed", "db:verify"];
}

function isListening(targetPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port: targetPort,
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

if (!prepareOnly && (await isListening(port))) {
  console.error(`Port ${port} is already occupied. No process was stopped.`);
  if (process.platform === "win32") {
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object OwningProcess`,
      ],
      { stdio: "inherit" },
    );
  }
  process.exit(1);
}

for (const command of await selectDatabaseStartupCommands()) {
  const result = spawnSync("npm", ["run", command], {
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (prepareOnly) {
  console.log("Local database is ready.");
  process.exit(0);
}

const server = spawn("npm", ["run", "dev:server"], {
  shell: true,
  stdio: "inherit",
});
for (let attempt = 1; attempt <= 60; attempt += 1) {
  try {
    const response = await fetch(`${url}/api/health`);
    if (response.ok) break;
  } catch {}
  if (attempt === 60) {
    server.kill();
    throw new Error(
      "Local application did not become healthy within 60 seconds.",
    );
  }
  await delay(1_000);
}

console.log(`Local URL: ${url}`);
if (process.platform === "win32")
  spawn("cmd", ["/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
  }).unref();
else if (process.platform === "darwin")
  spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
else spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();

process.on("SIGINT", () => server.kill("SIGINT"));
process.on("SIGTERM", () => server.kill("SIGTERM"));
await new Promise((resolve) => server.once("exit", resolve));
