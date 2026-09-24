import { readFile } from "node:fs/promises";
import type { LookupReport, Signal } from "../../shared/types";
import { MESSAGE, messageReport } from "./fixtures/reports";
import { fullStream, partialStream } from "./fixtures/sse";
import { expect, test } from "./support/test";

const SEARCH = `/search?q=${encodeURIComponent(MESSAGE)}`;

test("@verdict-meter exposes the score as an accessible meter with a visible number and label", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream((_url, call) => (call === 1 ? partialStream(report, ["community"]) : fullStream(report)));
    await page.goto(SEARCH);
    await expect(app.scorePending()).toBeVisible();
    expect(await app.scorePending().getAttribute("aria-valuenow")).toBeNull();

    await page.reload();
    await expect(app.verdictMeter()).toHaveAttribute("aria-valuenow", "98");
    await expect(app.verdictMeter()).toHaveAttribute("aria-valuemin", "0");
    await expect(app.verdictMeter()).toHaveAttribute("aria-valuemax", "100");
    await expect(app.verdictMeter()).toHaveAttribute("aria-valuetext", "98 out of 100, Dangerous");
    await expect(app.verdictMeterRow()).toContainText("98");
    await expect(app.verdictMeterRow()).toContainText("Dangerous");
});

test("@red-flags shows the top five with Show all, each linking to its source card", async ({ page, api, app }) => {
    const base = messageReport();
    const extra: Signal[] = Array.from({ length: 5 }, (_, i) => ({ id: `text.extra${i}`, label: `Extra tactic ${i + 1}`, kind: "risk", severity: "medium" }));
    const message = base.checks.find((c) => c.id === "text.message")!;
    const withMore = { ...message, signals: [...message.signals, ...extra] };
    const report: LookupReport = {
        ...base,
        checks: base.checks.map((c) => (c.id === "text.message" ? withMore : c)),
        verdict: { ...base.verdict, topSignals: withMore.signals.filter((s) => s.kind === "risk") },
    };
    await api.stream(fullStream(report));
    await page.goto(SEARCH);

    await expect(app.redFlags()).toHaveCount(5);
    await app.redFlagShowAll(8).click();
    await expect(app.redFlags()).toHaveCount(8);
    for (const href of await app.redFlagLinks()) expect(href).toBe("#source-text.message");
});

test("@message-target long messages are clamped with a Show full message control", async ({ page, api, app }) => {
    const long = `${MESSAGE} ${MESSAGE}`;
    const report = messageReport({ target: { type: "text", input: long, normalized: long } });
    await api.stream(fullStream(report));
    await page.goto(`/search?q=${encodeURIComponent(long)}`);
    await expect(app.showFullMessage()).toHaveAttribute("aria-expanded", "false");
    await app.showFullMessage().click();
    await expect(app.targetHeading()).toContainText(long);
});

test("@findings-filter the overview table and cards filter by outcome", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream(fullStream(report));
    await page.goto(SEARCH);
    const ran = report.checks.filter((c) => c.status !== "skipped");
    await expect(app.findingRows()).toHaveCount(ran.length);

    const expected = {
        Flags: ran.filter((c) => c.status === "warning" || c.status === "danger").length,
        Clean: ran.filter((c) => c.status === "clean").length,
        Unavailable: ran.filter((c) => c.status === "error").length,
    };
    for (const [name, count] of Object.entries(expected) as [keyof typeof expected, number][]) {
        await app.selectFilter(name);
        await expect(app.findingsFilter(name)).toBeChecked();
        await expect(app.findingRows()).toHaveCount(count);
        await expect(app.sourceCards()).toHaveCount(count);
    }
    await app.selectFilter("All");
    await expect(app.sourceCards()).toHaveCount(ran.length);
});

test("@source-attribution every source card names its source", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    const cards = await app.sourceCards().count();
    expect(cards).toBeGreaterThan(0);
    await expect(app.cardSourceAttribution(app.sourceCards())).toHaveCount(cards);
});

test.describe("copy", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("@copy copies a fact value and confirms it", async ({ page, api, app }) => {
        await api.stream(fullStream(messageReport()));
        await page.goto(SEARCH);
        const card = app.sourceCard("Scam language analysis");
        await app.cardCopyButton(card, "First link").click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("http://amaz0n-verify.top/login");
        await expect(app.copyFeedback(card, "Copied")).toBeAttached();
    });
});

test("@copy says so when copying fails", async ({ page, api, app }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
    });
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await app.copyLinkButton().click();
    await expect(app.copyFeedback(app.page, "Couldn't copy")).toBeAttached();
});

test("@export-json downloads the report as JSON", async ({ page, api, app }) => {
    const report = messageReport();
    await api.stream(fullStream(report));
    await page.goto(SEARCH);
    const [download] = await Promise.all([page.waitForEvent("download"), app.exportJsonButton().click()]);
    expect(download.suggestedFilename()).toMatch(/^scamshield-text-\d+\.json$/);
    expect(JSON.parse(await readFile(await download.path(), "utf8"))).toEqual(report);
});

test("@export-csv downloads a spreadsheet-safe CSV", async ({ page, api, app }) => {
    const base = messageReport();
    const hostile: Signal = { id: "text.hostile", label: '=HYPERLINK("http://x","y")', kind: "risk", severity: "high" };
    const report: LookupReport = { ...base, checks: base.checks.map((c) => (c.id === "text.message" ? { ...c, signals: [...c.signals, hostile] } : c)) };
    await api.stream(fullStream(report));
    await page.goto(SEARCH);
    const [download] = await Promise.all([page.waitForEvent("download"), app.exportCsvButton().click()]);
    expect(download.suggestedFilename()).toMatch(/^scamshield-text-\d+\.csv$/);

    const bytes = await readFile(await download.path());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
    const lines = text.split("\r\n");
    expect(lines[0]).toBe(
        ["generated_at", "target_type", "target", "source_id", "source_name", "category", "status", "summary", "signal_kind", "signal_severity", "signal_label", "source_url", "duration_ms"]
            .map((c) => `"${c}"`)
            .join(","),
    );
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
});

test("@color-independence every status, level and severity is also written as a word", async ({ page, api, app }) => {
    await api.stream(fullStream(messageReport()));
    await page.goto(SEARCH);
    await expect(app.verdictLabel("Dangerous")).toBeVisible();
    const texts = await app.statusWords().allTextContents();
    expect(texts.length).toBeGreaterThan(10);
    for (const t of texts) expect(t.trim()).not.toBe("");
});
