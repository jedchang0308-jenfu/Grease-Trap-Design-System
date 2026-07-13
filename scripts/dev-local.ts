import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.PORT ?? 3100);
const url = `http://localhost:${port}`;

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

if (await isListening(port)) {
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

for (const command of [
  "db:up",
  "db:wait",
  "db:migrate",
  "db:seed",
  "db:verify",
]) {
  const result = spawnSync("npm", ["run", command], {
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
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
