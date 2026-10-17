import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/nexus',
      MONGODB_DB: process.env.MONGODB_DB ?? 'nexus',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'playwright-only-secret-not-for-production',
      AUTH_URL: `${baseURL}/api/auth`,
      AUTH_TRUST_HOST: 'true',
      AUTH_COOKIE_SECURE: 'false',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
