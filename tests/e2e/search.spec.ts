import { CATEGORY_ORDER, MESSAGE, domainReport, messageReport } from "./fixtures/reports";
import { fullStream, partialStream } from "./fixtures/sse";
import { expect, test } from "./support/test";

const SEARCH = `/search?q=${encodeURIComponent(MESSAGE)}`;
const ANSWERED = ["community", "text.message"];

test("@F05 streamed lookup renders the verdict and one card per source that ran", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream(fullStream(report));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    expect(await app.score()).toBe(98);
    await expect(app.sourceCards()).toHaveCount(report.checks.filter((c) => c.status !== "skipped").length);
    await expect(app.pendingSources()).toHaveCount(0);
});

test("@F06 a valid ?type= is forwarded and an invalid one is dropped", async ({ page, api, app }) => {
    await api.stream(fullStream(domainReport()));
    await page.goto("/search?q=example.com&type=text");
    await expect(app.verdictLabel("No red flags")).toBeVisible();
    await page.goto("/search?q=example.com&type=bogus");
    await expect(app.verdictLabel("No red flags")).toBeVisible();
    expect(api.streamUrls.map((u) => u.searchParams.get("type"))).toEqual(["text", null]);
});

test("@F07 result groups follow the fixed category order", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    expect(await app.categoryOrder()).toEqual([...CATEGORY_ORDER]);
});

test("@F08 skipped sources are listed as not run, with their reason", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await expect(app.notRun()).toContainText("Have I Been Pwned (Requires HIBP_API_KEY)");
    await expect(app.sourceCard("Have I Been Pwned")).toHaveCount(0);
});

// Behaviour change (plan §4.3): long messages are clamped to 3 lines with "Show full message"
// instead of being cut at 140 characters, so the whole message is available.
test("@F09 target header shows type, the message, duration or cache age", async ({ page, api, app }) => {
    await api.stream((_url, call) =>
        fullStream(call === 1 ? messageReport() : messageReport({ cached: true, generatedAt: new Date(Date.now() - 4 * 60_000).toISOString() })),
    );
    await page.goto(SEARCH);
    await expect(app.targetType("Message")).toBeVisible();
    await expect(app.targetHeading()).toContainText(MESSAGE);
    await expect(app.durationBadge()).toHaveText("3.2 s");

    await page.reload();
    await expect(app.cachedBadge()).toContainText("4 min ago");
});

test.describe("clipboard", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("@F10 copy link puts the shareable lookup URL on the clipboard", async ({ page, api, app }) => {
        await api.stream(fullStream(messageReport()));
        await page.goto(SEARCH);
        await app.copyLinkButton().click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    });
});

test("@F11 JSON export downloads the full report", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream(fullStream(report));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), app.exportJsonButton().click()]);
    expect(download.suggestedFilename()).toMatch(/^scamshield-text-\d+\.json$/);
    const file = await download.path();
    const { readFile } = await import("node:fs/promises");
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(report);
});

test("@F12 refresh bypasses the cache and blocks resubmission while running", async ({ page, api, app }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await api.stream(fullStream(messageReport()), { gate: (call) => (call === 2 ? held : undefined) });
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();

    await app.refreshButton().click();
    await expect.poll(() => api.streamUrls.length).toBe(2);
    expect(api.streamUrls[1].searchParams.get("fresh")).toBe("1");
    await expect(app.submitButton()).toBeDisabled();

    release();
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    await expect(app.submitButton()).toBeEnabled();
});

test("@F14 verdict shows progress while pending and score, label, confidence when done", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream((_url, call) => (call === 1 ? partialStream(report, ANSWERED) : fullStream(report)));
    await page.goto(SEARCH);
    await expect(app.scorePending()).toBeVisible();
    await expect(app.progressText(ANSWERED.length, report.checks.length)).toBeVisible();

    await page.reload();
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    expect(await app.score()).toBe(98);
    await expect(app.verdictMeta()).toContainText("Confidence 86%");
    await expect(app.verdictMeta()).toContainText(`${report.checks.length} sources`);
});

test("@F15 AI-written summaries are marked; rule-based ones are not", async ({ page, api, app }) => {
    await api.stream((url) => fullStream(url.searchParams.get("q") === "example.com" ? domainReport() : messageReport()));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    await expect(app.aiIndicator()).toBeVisible();

    await page.goto("/search?q=example.com");
    await expect(app.verdictLabel("No red flags")).toBeVisible();
    await expect(app.aiIndicator()).toHaveCount(0);
});

test("@F16 verdict lists red flags, trust signals and what to do", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream(fullStream(report));
    await page.goto(SEARCH);
    await expect(app.verdictSection("summary")).toContainText(report.summary.text);
    for (const s of report.verdict.topSignals) await expect(app.verdictSection("redFlags")).toContainText(s.label);
    for (const s of report.verdict.trustSignals) await expect(app.verdictSection("trust")).toContainText(s.label);
    for (const r of report.summary.recommendations) await expect(app.verdictSection("recommendations")).toContainText(r);
});

test("@F17 verdict stays in view while scrolling results", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    await app.settle();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    const box = await app.verdictAside().boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(56); // below the sticky header…
    expect(box?.y).toBeLessThanOrEqual(120); // …and still pinned near the top
});

test("@F18 source cards show status, evidence, items, attribution and timing", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);

    const message = app.sourceCard("Scam language analysis");
    await expect(app.cardStatus(message, "Alert")).toBeVisible();
    await expect(app.cardText(message, "7 manipulation tactics detected, 1 indicator(s) extracted")).toBeVisible();
    await expect(app.cardText(message, "Asks for passwords, PINs or verification codes")).toBeVisible();
    await expect(app.cardText(message, "First link")).toBeVisible();
    await expect(app.cardLink(message, "http://amaz0n-verify.top/login")).toHaveAttribute("href", "https://urlscan.io/search/#amaz0n-verify.top");
    await expect(app.cardSourceAttribution(message)).toHaveText("ScamShield analysis");

    const profiles = app.sourceCard("Public profiles");
    await expect(app.cardItems(profiles)).toHaveCount(6);
    await app.showAllButton(7).click();
    await expect(app.cardItems(profiles)).toHaveCount(7);
    await expect(app.cardText(profiles, "2024-01-01")).toBeVisible();
    await expect(app.cardLink(profiles, /Profile 1\b/)).toHaveAttribute("href", "https://profiles.example.test/1");
    await expect(app.cardSourceAttribution(profiles)).toHaveText("Source: Gravatar");
    await expect(app.cardLink(profiles, "Source: Gravatar")).toHaveAttribute("href", "https://gravatar.com");
    await expect(app.cardDuration(profiles, 312)).toBeVisible();

    const community = app.sourceCard("Community reports");
    await expect(app.cardSourceAttribution(community)).toHaveText("Source: ScamShield community");
    await expect(app.cardLink(community, "Source: ScamShield community")).toHaveCount(0);

    const breaches = app.sourceCard("Breach exposure");
    await expect(app.cardStatus(breaches, "Unavailable")).toBeVisible();
    await expect(app.cardText(breaches, "Timed out after 8000 ms")).toBeVisible();
});

test("@F19 in-app pivots open a new lookup without a full reload", async ({ page, api, app }) => {
    await api.stream((url) => fullStream(url.searchParams.get("q") === "amaz0n-verify.top" ? domainReport("amaz0n-verify.top") : messageReport()));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));

    await app.internalLink("/search?q=amaz0n-verify.top").click();
    await expect(page).toHaveURL("/search?q=amaz0n-verify.top");
    await expect(app.verdictLabel("No red flags")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
    expect(api.streamUrls.at(-1)?.searchParams.get("q")).toBe("amaz0n-verify.top");
});

test("@F20 sources that haven't answered show a pending placeholder", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream(partialStream(report, ANSWERED));
    await page.goto(SEARCH);
    await expect(app.sourceCards()).toHaveCount(ANSWERED.length);
    await expect(app.pendingSources()).toHaveCount(report.checks.length - ANSWERED.length);
});
