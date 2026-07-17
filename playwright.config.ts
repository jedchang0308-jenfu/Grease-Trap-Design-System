import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const playwrightOutputRoot = path.join(tmpdir(), "grease-trap-playwright");

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: path.join(playwrightOutputRoot, "test-results"),
  timeout: 120_000,
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
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:local",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
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
