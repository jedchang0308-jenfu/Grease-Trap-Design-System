import { spawn, spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const projectRoot = realpathSync(path.resolve(import.meta.dirname, ".."));
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
const host = "127.0.0.1";
const previewPort = 3210;

function listenForPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(actualPort)));
    });
  });
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1_000);
    const finish = (connected) => {
      socket.destroy();
      resolve(connected);
    };
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function stopProcess(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
    return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    return;
  }
  const result = spawnSync(
    "taskkill.exe",
    ["/PID", String(child.pid), "/T", "/F"],
    {
      stdio: "ignore",
      timeout: 5_000,
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    try {
      process.kill(child.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
    }
    throw result.error ?? new Error(`Could not stop E2E process ${child.pid}`);
  }
}

export default async function startE2EServer() {
  const scratch = path.join(projectRoot, "tmp");
  mkdirSync(scratch, { recursive: true });
  if (realpathSync(scratch) !== scratch) {
    throw new Error(
      `E2E scratch directory resolves outside its location: ${scratch}`,
    );
  }

  const runtime = mkdtempSync(path.join(scratch, "e2e-runtime-"));
  const identity = lstatSync(runtime);
  const configPath = path.join(runtime, "firebase.json");
  const outDir = path.join(runtime, "dist");
  const abort = new AbortController();
  const { signal } = abort;
  const children = [];
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith("=") && !/^(TEMP|TMP|TMPDIR)$/i.test(key),
      ),
    ),
    // Firebase writes a project-wide hub locator under the OS temp directory.
    TEMP: runtime,
    TMP: runtime,
    TMPDIR: runtime,
    VITE_FIREBASE_API_KEY: "demo-api-key",
    VITE_FIREBASE_AUTH_DOMAIN: "demo-grease-trap.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "demo-grease-trap",
    VITE_FIREBASE_APP_ID: "demo-app-id",
    VITE_USE_FIREBASE_EMULATORS: "true",
    VITE_REPORT_PDF_LOCAL: "true",
    REPORT_PDF_OUTPUT_DIR: path.join(runtime, "pdf"),
  };

  function launch(label, args, cwd = projectRoot) {
    signal.throwIfAborted();
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: "inherit",
      windowsHide: true,
    });
    const exited = new Promise((resolve) => {
      child.once("error", (error) => resolve({ error }));
      child.once("exit", (code, exitSignal) => resolve({ code, exitSignal }));
    });
    children.push(child);
    return { label, exited };
  }

  function exitError({ label }, { code, exitSignal, error }) {
    return new Error(
      `${label} exited (${exitSignal ?? code ?? "spawn error"})`,
      { cause: error },
    );
  }

  async function run(label, args) {
    const process = launch(label, args);
    const outcome = await process.exited;
    signal.throwIfAborted();
    if (outcome.code !== 0) throw exitError(process, outcome);
  }

  async function waitUntil(description, probe, services) {
    const polling = new AbortController();
    const waitSignal = AbortSignal.any([
      signal,
      polling.signal,
      AbortSignal.timeout(120_000),
    ]);
    try {
      await Promise.race([
        (async () => {
          while (!waitSignal.aborted && !(await probe())) {
            await delay(250, undefined, { signal: waitSignal });
          }
          waitSignal.throwIfAborted();
        })(),
        ...services.map(async (service) => {
          throw exitError(service, await service.exited);
        }),
      ]);
    } catch (error) {
      throw new Error(`${description} did not become ready`, { cause: error });
    } finally {
      polling.abort();
    }
  }

  function close() {
    if (signal.aborted) return;
    abort.abort();
    process.off("exit", closeOnExit);
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    const failures = [];
    for (const child of children.toReversed()) {
      try {
        stopProcess(child);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) {
      throw new AggregateError(failures, `E2E runtime retained at ${runtime}`);
    }
    const current = lstatSync(runtime, { throwIfNoEntry: false });
    if (!current) return;
    if (
      realpathSync(runtime) !== runtime ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino
    ) {
      throw new Error(
        `E2E runtime changed identity and was retained at ${runtime}`,
      );
    }
    rmSync(runtime, { recursive: true, maxRetries: 5, retryDelay: 100 });
  }

  function closeOnExit() {
    try {
      close();
    } catch (error) {
      console.error(error);
      process.exitCode ||= 1;
    }
  }

  function interrupt(code) {
    if (import.meta.main) process.exitCode = code;
    closeOnExit();
  }
  const onInterrupt = () => interrupt(130);
  const onTerminate = () => interrupt(143);
  process.once("exit", closeOnExit);
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  try {
    await listenForPort(previewPort);
    const allocatedPorts = new Set([previewPort]);
    while (allocatedPorts.size < 6) {
      signal.throwIfAborted();
      allocatedPorts.add(await listenForPort(0));
    }
    const [, authPort, firestorePort, websocketPort, hubPort, loggingPort] =
      allocatedPorts;
    env.VITE_FIREBASE_AUTH_EMULATOR_PORT = String(authPort);
    env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT = String(firestorePort);
    const config = JSON.parse(
      readFileSync(path.join(projectRoot, "firebase.json"), "utf8"),
    );
    config.firestore.rules = path.resolve(projectRoot, config.firestore.rules);
    config.firestore.indexes = path.resolve(
      projectRoot,
      config.firestore.indexes,
    );
    config.emulators = {
      ...config.emulators,
      auth: { host, port: authPort },
      firestore: { host, port: firestorePort, websocketPort },
      ui: { enabled: false },
      hub: { host, port: hubPort },
      logging: { host, port: loggingPort },
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    await run("Report font preparation", [prepareFonts]);
    await run("Vite test build", [viteCli, "build", "--outDir", outDir]);
    const emulator = launch(
      "Firebase emulators",
      [
        firebaseCli,
        "emulators:start",
        "--config",
        configPath,
        "--project",
        "demo-grease-trap",
        "--only",
        "auth,firestore",
      ],
      runtime,
    );
    await waitUntil(
      "Firebase emulators",
      async () => {
        const ports = await Promise.all([
          canConnect(authPort),
          canConnect(firestorePort),
        ]);
        return ports.every(Boolean);
      },
      [emulator],
    );

    const preview = launch("Vite preview", [
      viteCli,
      "preview",
      "--host",
      host,
      "--port",
      String(previewPort),
      "--strictPort",
      "--outDir",
      outDir,
    ]);
    await waitUntil(
      "Vite preview",
      async () => {
        try {
          const response = await fetch(`http://${host}:${previewPort}/cases`, {
            signal: AbortSignal.timeout(1_000),
          });
          await response.body?.cancel();
          return response.ok;
        } catch {
          return false;
        }
      },
      [emulator, preview],
    );

    if (import.meta.main) {
      const serviceExit = await Promise.race(
        [emulator, preview].map(async (service) => ({
          service,
          outcome: await service.exited,
        })),
      );
      if (!signal.aborted)
        throw exitError(serviceExit.service, serviceExit.outcome);
      close();
    } else {
      // Playwright owns test cancellation and invokes the returned teardown.
      process.off("SIGINT", onInterrupt);
    }
    return close;
  } catch (error) {
    if (import.meta.main && signal.aborted) return close;
    try {
      close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "E2E startup and cleanup failed",
      );
    }
    throw error;
  }
}

if (import.meta.main) await startE2EServer();
