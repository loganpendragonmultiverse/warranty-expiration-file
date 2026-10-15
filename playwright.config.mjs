import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  use: { browserName: "chromium" },
  workers: 1,
});
