import { domainReport, sources, stats } from "./fixtures/reports";
import { fullStream } from "./fixtures/sse";
import { expect, test } from "./support/test";

test("@F21 sources page lists status, reason, category, links and applicability", async ({ page, api, app }) => {
    await api.sources(sources);
    await page.goto("/sources");

    const hibp = app.sourceRow("Have I Been Pwned");
    await expect(app.rowText(hibp, /Requires HIBP_API_KEY/)).toBeVisible();
    await expect(app.rowText(hibp, /Breach & leak exposure/)).toBeVisible();
    await expect(app.sourceUpstreamLink(hibp, "Have I Been Pwned")).toHaveAttribute("href", "https://haveibeenpwned.com");
    await expect(app.rowText(hibp, "Email")).toBeVisible();

    const community = app.sourceRow("Community reports");
    await expect(app.rowText(community, /ScamShield community/)).toBeVisible();
    await expect(app.sourceUpstreamLink(community, "ScamShield community")).toHaveCount(0);
    await expect(app.rowText(community, "Message")).toBeVisible();

    await expect(app.aiSummariesFlag()).toBeVisible();
});

test("@F22 API page documents all six endpoints", async ({ page, app }) => {
    await app.gotoApiDocs();
    const paths = (await app.endpointPaths()).map((p) => p.split("?")[0]);
    expect(paths.sort()).toEqual(["/api/health", "/api/lookup", "/api/lookup/stream", "/api/reports", "/api/sources", "/api/stats"]);
});

test("@F23 unknown routes show a not-found page with a way home", async ({ page, app }) => {
    await page.goto("/definitely-not-a-page");
    await expect(app.notFoundHeading()).toBeVisible();
    await expect(app.homeLinkFromNotFound()).toHaveAttribute("href", "/");
});

test("@F24 shell: active nav on lookup pages, GitHub link and disclaimers", async ({ page, api, app }) => {
    await api.stats(stats);
    await api.stream(fullStream(domainReport()));

    await page.goto("/");
    expect(await app.isNavActive("Lookup")).toBe(true);
    expect(await app.isNavActive("Sources")).toBe(false);
    await expect(app.githubLink()).toHaveAttribute("href", "https://github.com/isaac-onyango-dev/scamshield");
    for (const d of app.disclaimers()) await expect(d).toBeVisible();

    await page.goto("/search?q=example.com");
    expect(await app.isNavActive("Lookup")).toBe(true);
    expect(await app.isNavActive("API")).toBe(false);
});

test("@F25 document metadata is present", async ({ page, api, app }) => {
    await api.stats(stats);
    await page.goto("/");
    const m = await app.metadata();
    expect(m.title).toContain("ScamShield");
    for (const key of ["description", "ogTitle", "ogDescription", "ogImage", "themeColor", "icon"] as const) {
        expect(m[key], key).toBeTruthy();
    }
});

test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("@F26 transitions are neutralised when the user prefers reduced motion", async ({ page, api, app }) => {
        await api.stats(stats);
        await page.goto("/");
        expect(await app.transitionSeconds(app.submitButton())).toBeLessThanOrEqual(0.00001);
    });
});

test("@F26 control: transitions run normally without the preference", async ({ page, api, app }) => {
    await api.stats(stats);
    await page.goto("/");
    expect(await app.transitionSeconds(app.submitButton())).toBeGreaterThan(0.00001);
});
