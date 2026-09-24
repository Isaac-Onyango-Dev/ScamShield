import type { DashboardStats } from "../../shared/types";
import { stats } from "./fixtures/reports";
import { expect, setStorageMode, test } from "./support/test";

const zero: DashboardStats = { totalLookups: 0, totalReports: 0, reportsLast24h: 0, knownScams: 0, topCategories: [] };

test("@state-home-stats-zero zero-valued stats are never rendered", async ({ page, api, app }) => {
    await api.stats({ ...zero, knownScams: 6 });
    await page.goto("/");
    await expect(app.statsRegion()).toHaveText("6 known scam indicators");
});

test("@state-home-stats-zero the row is omitted when every stat is zero", async ({ page, api, app }) => {
    await api.stats(zero);
    await page.goto("/");
    await expect(app.capabilityTable()).toBeVisible();
    await expect(app.statsRegion()).toHaveCount(0);
});

test("@state-home-stats-restart ephemeral storage qualifies restart-scoped stats", async ({ page, api, app }) => {
    await api.stats(stats);
    await page.goto("/");
    await expect(app.statsRegion()).toHaveText("7 reports in the last 24 h · 12,345 lookups run · 56 community reports since last restart · 6 known scam indicators");
});

test("@state-home-stats-restart persistent storage has no qualifier", async ({ page, api, app }) => {
    await setStorageMode(page, "persistent");
    await api.stats(stats);
    await page.goto("/");
    await expect(app.statsRegion()).toHaveText("7 reports in the last 24 h · 12,345 lookups run · 56 community reports · 6 known scam indicators");
});

test("@state-home-stats-restart no qualifier when only known indicators are shown", async ({ page, api, app }) => {
    await api.stats({ ...zero, knownScams: 6 });
    await page.goto("/");
    await expect(app.statsRegion()).not.toContainText("since last restart");
});

test("@state-home-stats hides the row when stats can't be loaded", async ({ page, app }) => {
    await page.route("**/api/stats", (route) => route.fulfill({ status: 500, json: { error: "boom" } }));
    await page.goto("/");
    await expect(app.capabilityTable()).toBeVisible();
    await expect(app.statsRegion()).toHaveCount(0);
});
