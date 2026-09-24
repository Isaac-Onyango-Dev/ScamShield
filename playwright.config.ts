import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const CI = !!process.env.CI;
const A11Y = /a11y\.spec\.ts$/;

/**
 * E2E safety net for the redesign (docs/REDESIGN_PLAN.md §7.1, P0).
 * Every /api call is mocked in the browser (tests/e2e/support/test.ts), so the real
 * server only serves the built client and no test ever reaches a live OSINT source.
 */
export default defineConfig({
    testDir: "tests/e2e",
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 1 : 0,
    reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: "retain-on-failure",
    },
    projects: [
        // Functional specs: one desktop configuration is enough.
        { name: "desktop", testIgnore: A11Y, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "dark" } },
        // Accessibility ratchet across colour schemes, a phone width and reduced motion.
        { name: "light", testMatch: A11Y, use: { ...devices["Desktop Chrome"], colorScheme: "light" } },
        { name: "dark", testMatch: A11Y, use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
        { name: "mobile-light", testMatch: A11Y, use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, colorScheme: "light" } },
        { name: "reduced-motion", testMatch: A11Y, use: { ...devices["Desktop Chrome"], colorScheme: "dark", contextOptions: { reducedMotion: "reduce" } } },
    ],
    webServer: {
        // CI builds in an earlier step and sets E2E_NO_BUILD to reuse dist/.
        command: process.env.E2E_NO_BUILD ? "node dist/index.js" : "npm run build && node dist/index.js",
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: !CI,
        timeout: 120_000,
        env: {
            NODE_ENV: "production",
            PORT: String(PORT),
            DATABASE_URL: ":memory:",
            // Forward-compatible with D1 (absolute URLs, https required in production).
            SITE_URL: "https://scamshield.e2e.test",
            LOG_LEVEL: "warn",
        },
    },
});
