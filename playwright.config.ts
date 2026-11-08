import { defineConfig, devices } from "@playwright/test";

const port = 3200;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const startsLocalServer = !process.env.PLAYWRIGHT_BASE_URL;
const usesProductionBuild = Boolean(process.env.CI || process.env.PLAYWRIGHT_USE_BUILD);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Traces and screenshots are sufficient for this suite and avoid requiring
    // ffmpeg on reception/developer machines.
    video: "off",
  },
  webServer: startsLocalServer
    ? {
        // CI validates the compiled application. Running Next in development
        // mode would require eval(), which the production CSP intentionally
        // blocks and can leave client navigation without hydration.
        command: `node node_modules/next/dist/bin/next ${usesProductionBuild ? "start" : "dev"} --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE ?? "fixtures",
          NEXT_PUBLIC_RELEASE_STAGE: process.env.NEXT_PUBLIC_RELEASE_STAGE ?? "beta",
        },
      }
    : undefined,
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
