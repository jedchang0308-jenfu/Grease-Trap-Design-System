import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const firebaseCli = path.join(
  projectRoot,
  "node_modules",
  "firebase-tools",
  "lib",
  "bin",
  "firebase.js",
);
const viteCli = path.join(
  projectRoot,
  "node_modules",
  "vite",
  "bin",
  "vite.js",
);
const prepareFonts = path.join(
  projectRoot,
  "scripts",
  "prepare-report-fonts.mjs",
);
const reportPdfOutputDirectory = path.join(
  tmpdir(),
  "grease-trap-e2e-pdfs",
  String(process.pid),
);

const baseEnv = Object.fromEntries(
  Object.entries(process.env)
    .filter(([key, value]) => !key.startsWith("=") && value != null)
    .map(([key, value]) => [key, String(value)]),
);

const env = {
  ...baseEnv,
  VITE_FIREBASE_API_KEY: "demo-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-grease-trap.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "demo-grease-trap",
  VITE_FIREBASE_APP_ID: "demo-app-id",
  VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_REPORT_PDF_LOCAL: "true",
  REPORT_PDF_OUTPUT_DIR: reportPdfOutputDirectory,
};

let emulatorProcess;
let previewProcess;
let shuttingDown = false;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} ${args.join(" ")} exited with code ${code}`),
        );
      }
    });
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 120_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect({ host, port });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

function stopProcess(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  if (child.killed) return;
  child.kill("SIGINT");
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopProcess(previewProcess);
  stopProcess(emulatorProcess);
  rmSync(reportPdfOutputDirectory, { recursive: true, force: true });
  setTimeout(() => process.exit(code), 700).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => {
  stopProcess(previewProcess);
  stopProcess(emulatorProcess);
  rmSync(reportPdfOutputDirectory, { recursive: true, force: true });
});

await run(process.execPath, [prepareFonts]);
await run(process.execPath, [viteCli, "build"]);

emulatorProcess = spawn(
  process.execPath,
  [
    firebaseCli,
    "emulators:start",
    "--project",
    "demo-grease-trap",
    "--only",
    "auth,firestore",
  ],
  { cwd: projectRoot, env, stdio: "inherit" },
);

emulatorProcess.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`Firebase emulator supervisor exited with code ${code}`);
  }
});

await Promise.all([waitForPort(8080), waitForPort(9099)]);

previewProcess = spawn(
  process.execPath,
  [viteCli, "preview", "--host", "127.0.0.1", "--port", "3210", "--strictPort"],
  { cwd: projectRoot, env, stdio: "inherit" },
);

previewProcess.on("exit", (code) => {
  if (!shuttingDown) shutdown(code ?? 0);
});
