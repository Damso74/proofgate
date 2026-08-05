import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Les tests tournent contre le BUILD final (`vite preview` sert `dist/`),
 * pas contre le serveur de développement.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: process.env.CI ? [["line"]] : [["list"]],
  use: { baseURL: BASE_URL, trace: "on-first-retry", screenshot: "only-on-failure" },

  projects: [
    { name: "w1920", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "w1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "w768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "w375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run preview",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
