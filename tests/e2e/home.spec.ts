import { domainReport, stats } from "./fixtures/reports";
import { fullStream } from "./fixtures/sse";
import { EXAMPLE_LABELS } from "./support/app";
import { expect, test } from "./support/test";

test.beforeEach(async ({ api }) => {
    await api.stats(stats);
    await api.stream(fullStream(domainReport()));
});

test("@F01 search input detects the type, submits on Enter and keeps Shift+Enter for newlines", async ({ page, app }) => {
    await page.goto("/");
    await expect(app.submitButton()).toBeDisabled();

    await app.searchInput().fill("someone@example.com");
    await expect(app.typeBadge()).toHaveText("Email");

    await app.searchInput().fill("hxxp://evil[.]com/login");
    await expect(app.typeBadge()).toHaveText("URL");
    await expect(app.submitButton()).toBeEnabled();

    await app.searchInput().fill("line one");
    await app.searchInput().press("Shift+Enter");
    await app.searchInput().pressSequentially("line two");
    await expect(app.searchInput()).toHaveValue("line one\nline two");
    await expect(page).toHaveURL("/");

    await app.searchInput().fill("example.com");
    await app.searchInput().press("Enter");
    await expect(page).toHaveURL("/search?q=example.com");
});

test("@F02 every example opens a lookup", async ({ page, app }) => {
    for (const label of EXAMPLE_LABELS) {
        await page.goto("/");
        await app.exampleLink(label).click();
        await expect(page).toHaveURL(/\/search\?q=.+/);
    }
});

test("@F03 public counters render and refresh every 60 s", async ({ page, api, app }) => {
    await page.clock.install();
    await page.goto("/");
    await expect(app.statsRegion()).toContainText("12,345");
    await expect(app.statsRegion()).toContainText("56");
    await expect(app.statsRegion()).toContainText("7");
    await expect(app.statsRegion()).toContainText("6");
    const before = api.statsCalls;
    await page.clock.fastForward("01:01");
    await expect.poll(() => api.statsCalls).toBeGreaterThan(before);
});

test("@F04 capability overview covers all six target types", async ({ page, app }) => {
    await page.goto("/");
    const groups = await app.capabilityGroups();
    expect(groups).toHaveLength(6);
    for (const g of groups) expect(g.points, g.title).toBeGreaterThan(0);
});

test("@guard unmocked /api requests are caught", async ({ page, api }) => {
    await page.goto("/definitely-not-a-page"); // makes no API calls of its own
    await page.evaluate(() => fetch("/api/health").then((r) => r.status));
    expect(api.unmocked).toEqual(["GET /api/health"]);
    api.unmocked.length = 0; // expected here; don't fail the fixture teardown
});
