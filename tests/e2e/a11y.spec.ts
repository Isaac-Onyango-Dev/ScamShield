import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { MESSAGE, messageReport, sources, stats } from "./fixtures/reports";
import { fullStream, partialStream } from "./fixtures/sse";
import type { Api } from "./support/test";
import type { App } from "./support/app";
import { expect, test, useScriptedStream } from "./support/test";

/**
 * Accessibility ratchet (docs/REDESIGN_PLAN.md §7.1, P0).
 * Each page's axe violations must be a subset of the committed baseline in
 * tests/e2e/a11y-baseline/<project>/<page>.json. New violations fail; fixed ones are
 * reported as annotations so the baseline can be tightened. The redesign must drive every
 * baseline to [] (checklist E2E-04). Regenerate with: A11Y_BASELINE=update npx playwright test --grep @axe
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const BASELINE_DIR = path.join(import.meta.dirname, "a11y-baseline");

const PAGES: { name: string; open: (ctx: { page: import("@playwright/test").Page; api: Api; app: App }) => Promise<void> }[] = [
    {
        name: "home",
        open: async ({ page, api, app }) => {
            await api.stats(stats);
            await page.goto("/");
            await expect(app.statsRegion()).toContainText("12,345");
        },
    },
    {
        name: "search",
        open: async ({ page, api, app }) => {
            await api.stream(fullStream(messageReport()));
            await page.goto(`/search?q=${encodeURIComponent(MESSAGE)}`);
            await expect(app.verdictLabel("Dangerous")).toBeVisible();
        },
    },
    {
        name: "report-dialog",
        open: async ({ page, api, app }) => {
            await api.stream(fullStream(messageReport()));
            await page.goto(`/search?q=${encodeURIComponent(MESSAGE)}`);
            await expect(app.verdictLabel("Dangerous")).toBeVisible();
            await app.reportButton().click();
            await expect(app.reportDialog()).toBeVisible();
        },
    },
    {
        name: "sources",
        open: async ({ page, api, app }) => {
            await api.sources(sources);
            await page.goto("/sources");
            await expect(app.aiSummariesFlag()).toBeVisible();
        },
    },
    {
        name: "search-error",
        open: async ({ page, api, app }) => {
            await api.stream(partialStream(messageReport(), ["community", "text.message"]));
            await page.goto(`/search?q=${encodeURIComponent(MESSAGE)}`);
            await expect(app.lookupError()).toBeVisible();
        },
    },
    {
        name: "search-rate-limited",
        open: async ({ page, api, app }) => {
            await api.stream(JSON.stringify({ error: "Too many lookups" }), { status: 429, headers: { "retry-after": "42" } });
            await page.goto(`/search?q=${encodeURIComponent(MESSAGE)}`);
            await expect(app.rateLimitCountdown()).toBeVisible();
        },
    },
    {
        name: "search-streaming",
        open: async ({ page, app }) => {
            const stream = await useScriptedStream(page);
            const report = messageReport();
            await page.goto(`/search?q=${encodeURIComponent(MESSAGE)}`);
            await stream.emit({ type: "start", target: report.target, checks: report.checks.map(({ id, name, category }) => ({ id, name, category })) });
            await stream.emit({ type: "check", result: report.checks[0] });
            await expect(app.lookupProgress()).toBeVisible();
        },
    },
    { name: "api", open: async ({ app }) => app.gotoApiDocs() },
    {
        name: "not-found",
        open: async ({ page, app }) => {
            await page.goto("/definitely-not-a-page");
            await expect(app.notFoundHeading()).toBeVisible();
        },
    },
];

for (const target of PAGES) {
    test(`@axe ${target.name} has no accessibility violations beyond the baseline`, async ({ page, api, app }, testInfo) => {
        await target.open({ page, api, app });
        await app.settle();

        const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const found = [...new Set(results.violations.map((v) => v.id))].sort();
        await testInfo.attach("violations.json", {
            body: JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 2),
            contentType: "application/json",
        });

        const file = path.join(BASELINE_DIR, testInfo.project.name, `${target.name}.json`);
        if (process.env.A11Y_BASELINE === "update") {
            await mkdir(path.dirname(file), { recursive: true });
            await writeFile(file, `${JSON.stringify(found, null, 2)}\n`);
            return;
        }

        const baseline: string[] = JSON.parse(await readFile(file, "utf8").catch(() => "null")) ?? [];
        const fixed = baseline.filter((id) => !found.includes(id));
        if (fixed.length) testInfo.annotations.push({ type: "a11y-fixed", description: `Remove from baseline: ${fixed.join(", ")}` });
        expect(found.filter((id) => !baseline.includes(id)), `new violations on ${target.name} (baseline: ${path.relative(process.cwd(), file)})`).toEqual([]);
    });
}
