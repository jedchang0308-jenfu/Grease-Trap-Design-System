import { randomUUID } from "node:crypto";
import { lstatSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Playwright workers reload this config and inherit the parent's run ID.
const runId = (process.env.GREASE_TRAP_E2E_RUN_ID ??= randomUUID());
if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(runId)) {
  throw new Error("Invalid E2E run ID");
}
const scratch = path.join(import.meta.dirname, "tmp");
const playwrightOutputRoot = path.join(scratch, `e2e-report-${runId}`);
for (const directory of [scratch, playwrightOutputRoot]) {
  if (lstatSync(directory, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(`E2E report path must not be a link: ${directory}`);
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: path.join(playwrightOutputRoot, "test-results"),
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.join(playwrightOutputRoot, "report"),
        open: "never",
      },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./scripts/start-e2e-server.mjs",
  projects: [
    {
      name: "desktop-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet-1024",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
