import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const WEB_PORT = 3000;
const AI_PORT = 8000;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const AI_URL = `http://127.0.0.1:${AI_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: WEB_URL,
    navigationTimeout: 120_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `python -m uvicorn app.main:app --host 127.0.0.1 --port ${AI_PORT} --app-dir apps/ai-service`,
      url: `${AI_URL}/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        AI_PROVIDER: "stub",
        CORS_ORIGINS: `["${WEB_URL}"]`,
      },
    },
    {
      command: `pnpm --filter @repo/web dev`,
      url: WEB_URL,
      reuseExistingServer: !isCI,
      timeout: 300_000,
      env: {
        AI_SERVICE_URL: AI_URL,
      },
    },
  ],
});
