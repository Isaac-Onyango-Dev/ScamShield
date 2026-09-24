import type { CheckResult, LookupReport } from "../../shared/types";
import { MESSAGE, messageReport } from "./fixtures/reports";
import { fullStream, partialStream } from "./fixtures/sse";
import { expect, test, useScriptedStream } from "./support/test";

const SEARCH = `/search?q=${encodeURIComponent(MESSAGE)}`;

test("@state-search-empty /search without a query shows an empty state with examples", async ({ page, app }) => {
    await page.goto("/search");
    await expect(app.emptyState("Enter something to look up.")).toBeVisible();
    await expect(app.exampleLink("Phishing domain")).toBeVisible();
});

test("@state-search-connecting shows skeletons and a starting status before the first event", async ({ page, api, app }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await api.stream(fullStream(messageReport()), { gate: () => held });
    await page.goto(SEARCH);
    await expect(app.lookupStatus()).toHaveText("Starting lookup…");
    await expect(app.pendingSources()).toHaveCount(0);
    release();
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
});

test("@state-search-streaming reports progress while sources are still answering", async ({ page, app }) => {
    const stream = await useScriptedStream(page);
    const report = messageReport();
    await page.goto(SEARCH);
    await stream.emit({ type: "start", target: report.target, checks: report.checks.map(({ id, name, category }) => ({ id, name, category })) });
    for (const c of report.checks.slice(0, 2)) await stream.emit({ type: "check", result: c });

    await expect(app.lookupStatus()).toHaveText(`Looking up… 2 of ${report.checks.length} sources`);
    await expect(app.lookupProgress()).toHaveAttribute("aria-valuenow", "2");
    await expect(app.lookupProgress()).toHaveAttribute("aria-valuemax", String(report.checks.length));
    await expect(app.scorePending()).toBeVisible();

    for (const c of report.checks.slice(2)) await stream.emit({ type: "check", result: c });
    await stream.emit({ type: "done", report });
    await expect(app.lookupStatus()).toHaveText("Done. Score 98, Dangerous.");
    await expect(app.lookupProgress()).toHaveCount(0);
});

test("@state-search-done announces the result once", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await expect(app.lookupStatus()).toHaveText("Done. Score 98, Dangerous.");
});

test("@state-search-invalid shows the server's validation message under the field", async ({ page, api, app }) => {
    await api.stream(JSON.stringify({ error: "Phone numbers need 6–15 digits." }), { status: 400 });
    await page.goto("/search?q=12");
    await expect(app.fieldError()).toHaveText("Phone numbers need 6–15 digits.");
    await expect(app.searchInput()).toHaveValue("12");
    await expect(app.searchInput()).toHaveAttribute("aria-invalid", "true");
    await expect(app.verdict()).toHaveCount(0);
});

test("@state-search-ratelimited counts down from Retry-After and blocks new lookups", async ({ page, api, app }) => {
    await page.clock.install();
    await api.stream(JSON.stringify({ error: "Too many lookups — please wait a minute and try again." }), { status: 429, headers: { "retry-after": "42" } });
    await page.goto(SEARCH);
    await expect(app.rateLimitCountdown()).toHaveText("Try again in 42 s.");
    await expect(app.submitButton()).toBeDisabled();
    await expect(app.alertAction("Try again")).toBeDisabled();

    await page.clock.fastForward(5_000);
    await expect(app.rateLimitCountdown()).toHaveText("Try again in 37 s.");

    await page.clock.fastForward(40_000);
    await expect(app.rateLimitCountdown()).toHaveText("You can try again now.");
    await expect(app.submitButton()).toBeEnabled();
    await expect(app.alertAction("Try again")).toBeEnabled();
});

test("@state-search-ratelimit-fallback uses the RateLimit reset, then 60 s", async ({ page, api, app }) => {
    await api.stream((url) => JSON.stringify({ error: `limited ${url.searchParams.get("q")}` }), {
        status: 429,
        headers: {},
    });
    await page.route(
        (url) => url.pathname === "/api/lookup/stream" && url.searchParams.get("q") === "with-reset",
        (route) => route.fulfill({ status: 429, headers: { "content-type": "application/json", ratelimit: "limit=20, remaining=0, reset=17" }, body: "{}" }),
    );
    await page.goto("/search?q=with-reset");
    await expect(app.rateLimitCountdown()).toHaveText("Try again in 17 s.");
    await page.goto("/search?q=no-headers");
    await expect(app.rateLimitCountdown()).toHaveText("Try again in 60 s.");
});

test("@state-search-network keeps partial results and offers Retry", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream((_url, call) => (call === 1 ? partialStream(report, ["community", "text.message"]) : fullStream(report)));
    await page.goto(SEARCH);
    await expect(app.lookupError()).toContainText("Connection lost before the lookup finished.");
    await expect(app.lookupError()).toContainText(`2 of ${report.checks.length} sources answered; the results below are incomplete.`);
    await expect(app.sourceCards()).toHaveCount(2);

    await app.alertAction("Retry").click();
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    expect(api.streamUrls).toHaveLength(2);
    expect(api.streamUrls[1].searchParams.get("fresh")).toBeNull();
});

test("@state-search-fallback asks once more to explain a failed stream, then stops", async ({ page, api, app }) => {
    await api.stream(""); // 200 with an empty body: the stream closes before any event
    await page.goto(SEARCH);
    await expect(app.lookupError()).toContainText("Connection lost before the lookup finished.");
    // The alert is only shown after the diagnostic request has completed, so the count is final.
    expect(api.streamUrls.length).toBeLessThanOrEqual(2);
});

test("@state-search-allfailed shows 'Not enough data' instead of a score", async ({ page, api, app }) => {
    const base = messageReport();
    const failed: LookupReport = {
        ...base,
        verdict: { ...base.verdict, score: 0, level: "safe", label: "No red flags", confidence: 0, topSignals: [], trustSignals: [] },
        checks: base.checks.map((c): CheckResult => ({ ...c, status: "error", error: "Timed out", signals: [], facts: [], items: [] })),
    };
    await api.stream(fullStream(failed));
    await page.goto(SEARCH);
    await expect(app.notEnoughData()).toBeVisible();
    await expect(app.verdictMeter()).toHaveCount(0);
    await expect(app.lookupStatus()).toHaveText("Done. Not enough data for a score.");
});

test("@state-source-error distinguishes a source's rate limit from other failures", async ({ page, api, app }) => {
    const base = messageReport();
    const report: LookupReport = {
        ...base,
        checks: base.checks.map((c) => (c.id === "email.xposedornot" ? { ...c, error: "Rate limited by upstream source — try again shortly" } : c)),
    };
    await api.stream(fullStream(report));
    await page.goto(SEARCH);
    await expect(app.cardStatus(app.sourceCard("Breach exposure"), "Rate limited by source")).toBeVisible();
    await expect(app.cardText(app.sourceCard("Breach exposure"), "Rate limited by source. Try Refresh in a few minutes.")).toBeVisible();
});

test.describe("report dialog outcomes", () => {
    test.beforeEach(async ({ page, api, app }) => {
        await api.stream(fullStream(messageReport()));
        await page.goto(SEARCH);
        await expect(app.verdictLabel("Dangerous")).toBeVisible();
        await app.reportButton().click();
    });

    for (const [status, body, tone, text] of [
        [201, { duplicate: false, message: "Report received. Thank you for protecting others." }, "success", "Report received."],
        [200, { duplicate: true, message: "You've already reported this — thanks!" }, "info", "already reported"],
        [500, { error: "Could not save report" }, "danger", "Could not save report"],
        [429, { error: "Too many reports from this network — try again later." }, "warning", "Too many reports from your network. Try again later."],
    ] as const) {
        test(`@state-report HTTP ${status} shows a ${tone} alert`, async ({ api, app }) => {
            await api.report(status, body);
            await app.submitReportButton().click();
            await expect(app.reportDialog().locator(`[data-tone="${tone}"]`).filter({ hasText: text })).toBeVisible();
        });
    }
});
