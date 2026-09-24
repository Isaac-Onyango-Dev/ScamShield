import type { Locator, Page } from "@playwright/test";
import type { CheckCategory, ReportCategory } from "../../../shared/types";

/**
 * Page-object layer: the ONLY place in tests/e2e that knows the current UI's wording,
 * roles and markup. Specs assert behaviour through these methods, so when the redesign
 * (docs/REDESIGN_PLAN.md P2–P5) renames "Investigate" to "Look up" or swaps a class-based
 * active state for aria-current, only this file changes. Editing a spec during the
 * redesign means behaviour changed, which needs a reason.
 */

/** Section titles on the results page → category ids (lib/ui.ts CATEGORY_LABELS). */
const CATEGORY_TITLES: Record<string, CheckCategory> = {
    "Community intelligence": "community",
    "Threat reputation": "reputation",
    "Content analysis": "content",
    "Identity & footprint": "identity",
    "Breach & leak exposure": "exposure",
    Infrastructure: "infrastructure",
    "Specialist tools": "pivots",
};

export const EXAMPLE_LABELS = ["Phishing domain", "Email", "Short link", "Phone", "IP", "SMS"] as const;

export class App {
    constructor(readonly page: Page) {}

    // ── Shell ────────────────────────────────────────────────────────────────
    navLink(name: "Lookup" | "Sources" | "API"): Locator {
        return this.page.getByRole("navigation").getByRole("link", { name, exact: true });
    }

    async isNavActive(name: "Lookup" | "Sources" | "API"): Promise<boolean> {
        const cls = (await this.navLink(name).getAttribute("class")) ?? "";
        const current = await this.navLink(name).getAttribute("aria-current");
        return current === "page" || cls.includes("bg-white/[0.07]");
    }

    githubLink(): Locator {
        return this.page.getByRole("link", { name: "Source code on GitHub" });
    }

    disclaimers(): Locator[] {
        return [this.page.getByText(/Public sources only/), this.page.getByText(/Results are indicators, not proof/)];
    }

    notFoundHeading(): Locator {
        return this.page.getByRole("heading", { name: "Page not found" });
    }

    homeLinkFromNotFound(): Locator {
        return this.page.getByRole("main").getByRole("link", { name: /lookup/i });
    }

    // ── Search input (Home + Search) ─────────────────────────────────────────
    searchInput(): Locator {
        return this.page.getByRole("textbox", { name: "Email, link, domain, IP, phone number or message" });
    }

    submitButton(): Locator {
        return this.page.getByRole("search").getByRole("button", { name: "Look up" });
    }

    /** Live type badge next to the field; resolves to its label text (e.g. "Email"). */
    typeBadge(): Locator {
        return this.page.getByRole("search").locator("span.bg-accent-tint");
    }

    /** Validation message shown under the field (HTTP 400). */
    fieldError(): Locator {
        return this.page.getByRole("search").locator("p.text-danger");
    }

    exampleLink(label: (typeof EXAMPLE_LABELS)[number]): Locator {
        return this.page.getByRole("main").getByRole("link", { name: label, exact: true });
    }

    // ── Home ─────────────────────────────────────────────────────────────────
    statsRegion(): Locator {
        return this.page.getByTestId("stats-row");
    }

    capabilityTable(): Locator {
        return this.page.getByTestId("capabilities");
    }

    async capabilityGroups(): Promise<{ title: string; points: number }[]> {
        return this.page.getByTestId("capabilities").locator("tbody tr").evaluateAll((rows) =>
            rows.map((r) => ({
                title: r.querySelector("th")?.textContent?.trim() ?? "",
                points: (r.querySelector("td")?.textContent ?? "").split(",").filter((p) => p.trim()).length,
            })),
        );
    }

    emptyState(title: string): Locator {
        return this.page.getByRole("main").getByText(title, { exact: true });
    }

    // ── Results ──────────────────────────────────────────────────────────────
    targetHeading(): Locator {
        return this.page.getByRole("heading", { level: 1 });
    }

    /** Type label in the results header (not the live badge inside the search field). */
    targetType(label: string): Locator {
        return this.page.getByTestId("target-type").filter({ hasText: new RegExp(`^${label}$`) });
    }

    cachedBadge(): Locator {
        return this.page.getByTestId("cached-badge");
    }

    durationBadge(): Locator {
        return this.page.getByTestId("duration");
    }

    checkedAt(): Locator {
        return this.page.locator("time[datetime]");
    }

    showFullMessage(): Locator {
        return this.page.getByRole("button", { name: "Show full message" });
    }

    lookupStatus(): Locator {
        return this.page.getByRole("main").locator('p[role="status"]');
    }

    lookupProgress(): Locator {
        return this.page.getByRole("progressbar", { name: "Sources answered" });
    }

    lookupAlert(): Locator {
        return this.page.getByRole("main").locator("[data-tone]").first();
    }

    rateLimitCountdown(): Locator {
        return this.page.getByTestId("rate-limit-countdown");
    }

    alertAction(name: "Retry" | "Try again"): Locator {
        return this.page.getByRole("main").getByRole("button", { name, exact: true });
    }

    lookupError(): Locator {
        return this.page.getByRole("main").locator('[role="alert"]').first();
    }

    copyLinkButton(): Locator {
        return this.page.getByRole("button", { name: "Copy link" });
    }

    exportJsonButton(): Locator {
        return this.page.getByRole("group", { name: "Export report" }).getByRole("button", { name: "JSON" });
    }

    exportCsvButton(): Locator {
        return this.page.getByRole("group", { name: "Export report" }).getByRole("button", { name: "CSV" });
    }

    refreshButton(): Locator {
        return this.page.getByRole("button", { name: "Refresh" });
    }

    reportButton(): Locator {
        return this.page.getByRole("button", { name: "Report…", exact: true });
    }

    verdict(): Locator {
        return this.page.getByRole("region", { name: "Verdict" });
    }

    verdictAside(): Locator {
        return this.page.locator("aside").first();
    }

    verdictMeter(): Locator {
        return this.page.getByRole("meter", { name: "Risk score" });
    }

    /** Numeric score once scored, or null while pending. */
    async score(): Promise<number | null> {
        const now = await this.verdictMeter().getAttribute("aria-valuenow");
        return now === null ? null : Number(now);
    }

    scorePending(): Locator {
        return this.page.locator('[data-testid="verdict-meter"][aria-busy="true"]');
    }

    verdictLabel(label: string): Locator {
        return this.verdict().locator("[data-level]").filter({ hasText: new RegExp(`^${label}$`) });
    }

    notEnoughData(): Locator {
        return this.verdict().getByText("Not enough data", { exact: true });
    }

    verdictMeta(): Locator {
        return this.verdict().getByText(/Confidence \d+%/);
    }

    /** "n of m sources" as shown in the status line, header meta or error alert. */
    progressText(done: number, total: number): Locator {
        return this.page.getByRole("main").getByText(new RegExp(`\\b${done} of ${total} sources`)).first();
    }

    aiIndicator(): Locator {
        return this.verdict().getByText("Written by AI · the score is rule-based");
    }

    verdictSection(name: "summary" | "redFlags" | "trust" | "recommendations"): Locator {
        const title = { summary: /^Summary$/, redFlags: /^Red flags/, trust: /^Trust signals$/, recommendations: /^What to do$/ }[name];
        return this.verdict().locator("section").filter({ has: this.page.getByRole("heading", { level: 3, name: title }) });
    }

    redFlags(): Locator {
        return this.verdictSection("redFlags").locator("li");
    }

    redFlagLinks(): Promise<(string | null)[]> {
        return this.redFlags().locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    }

    verdictMeterRow(): Locator {
        return this.verdict().getByTestId("verdict-meter");
    }

    /** Every element carrying a status, level or severity (each must also be written as a word). */
    statusWords(): Locator {
        return this.page.locator("[data-status], [data-level], [data-severity]");
    }

    /** Result text of a CopyButton ("Copied" / "Couldn't copy") within a scope. */
    copyFeedback(scope: Locator | Page, text: "Copied" | "Couldn't copy"): Locator {
        return scope.getByText(text, { exact: true }).first();
    }

    redFlagShowAll(count: number): Locator {
        return this.verdictSection("redFlags").getByRole("button", { name: `Show all ${count}` });
    }

    sourceCards(): Locator {
        return this.page.getByTestId("source-card");
    }

    sourceCard(name: string): Locator {
        return this.sourceCards().filter({ has: this.page.getByRole("heading", { level: 3, name, exact: true }) });
    }

    pendingSources(): Locator {
        return this.page.getByTestId("pending-source");
    }

    async categoryOrder(): Promise<CheckCategory[]> {
        const titles = await this.page.getByRole("main").locator("h2").allTextContents();
        return titles.map((t) => CATEGORY_TITLES[t.trim()]).filter(Boolean);
    }

    notRun(): Locator {
        return this.page.getByText(/^Not run:/);
    }

    showAllButton(count: number): Locator {
        return this.page.getByTestId("source-card").getByRole("button", { name: `Show all ${count}` });
    }

    /** Result items (profiles, extracted indicators, pivots) rendered inside a card. */
    cardItems(card: Locator): Locator {
        return card.getByTestId("card-items").locator(":scope > li");
    }

    cardLink(card: Locator, name: string | RegExp): Locator {
        return card.getByRole("link", { name, exact: typeof name === "string" });
    }

    cardText(card: Locator, text: string | RegExp): Locator {
        return card.getByText(text);
    }

    cardSourceAttribution(card: Locator): Locator {
        return card.getByTestId("source-attribution");
    }

    cardDuration(card: Locator, ms: number): Locator {
        return card.getByText(`Answered in ${ms} ms`);
    }

    cardStatus(card: Locator, label: string): Locator {
        return card.locator("header [data-status]").filter({ hasText: new RegExp(`^${label}$`) });
    }

    cardCopyButton(card: Locator, factLabel: string): Locator {
        return card.getByRole("button", { name: `Copy ${factLabel}` });
    }

    findingRows(): Locator {
        return this.page.getByTestId("finding-row");
    }

    findingsFilter(name: "All" | "Flags" | "Clean" | "Unavailable"): Locator {
        return this.page.getByRole("radiogroup", { name: "Filter findings" }).getByRole("radio", { name: new RegExp(`^${name}\\b`) });
    }

    async selectFilter(name: "All" | "Flags" | "Clean" | "Unavailable") {
        await this.page.getByRole("radiogroup", { name: "Filter findings" }).locator("label", { has: this.page.getByRole("radio", { name: new RegExp(`^${name}\\b`) }) }).click();
    }

    /** In-app link produced by a source (e.g. an indicator extracted from a message). */
    internalLink(href: string): Locator {
        return this.page.locator(`a[href="${href}"]`).first();
    }

    // ── Report dialog ────────────────────────────────────────────────────────
    reportDialog(): Locator {
        return this.page.getByRole("dialog");
    }

    categoryOption(c: ReportCategory): Locator {
        return this.reportDialog().getByRole("radio", { name: c, exact: true });
    }

    /** Chooses a category the way a user does: by clicking its visible label. */
    async selectCategory(c: ReportCategory) {
        await this.reportDialog().locator("label", { has: this.page.getByRole("radio", { name: c, exact: true }) }).click();
    }

    categoryOptions(): Locator {
        return this.reportDialog().getByRole("radio");
    }

    async selectedCategory(): Promise<string | null> {
        return this.categoryOptions().evaluateAll((inputs) => (inputs as HTMLInputElement[]).find((i) => i.checked)?.value ?? null);
    }

    reportDescription(): Locator {
        return this.reportDialog().getByLabel(/What happened/);
    }

    submitReportButton(): Locator {
        return this.reportDialog().getByRole("button", { name: "Submit report" });
    }

    storageNotice(): Locator {
        return this.page.getByText(/Reports are stored temporarily on this demo deployment/).first();
    }

    // ── Sources / API ────────────────────────────────────────────────────────
    sourceRow(name: string): Locator {
        return this.page.getByTestId("source-row").filter({ has: this.page.getByText(name, { exact: true }) }).first();
    }

    /** Category heading of the group a source is listed under. */
    sourceRowCategory(name: string): Promise<string> {
        return this.sourceRow(name).evaluate((row) => row.closest("section")?.querySelector("h2")?.textContent?.trim() ?? "");
    }

    sourceUpstreamLink(row: Locator, name: string): Locator {
        return row.getByRole("link", { name: `Source: ${name}`, exact: true });
    }

    rowText(row: Locator, text: string | RegExp): Locator {
        return row.getByText(text);
    }

    aiSummariesFlag(): Locator {
        return this.page.getByText(/Summaries are written by AI/);
    }

    /** Opens the API docs page (moved from /api to /api-docs so direct loads work, audit #32). */
    async gotoApiDocs() {
        await this.page.goto("/api-docs");
        await this.page.getByRole("heading", { level: 1, name: "API" }).waitFor();
    }

    async endpointPaths(): Promise<string[]> {
        return this.page.getByRole("main").locator("code").filter({ hasText: /^\/api\// }).allTextContents();
    }

    // ── Focus ────────────────────────────────────────────────────────────────
    focusedText(): Promise<string> {
        return this.page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    }

    focusedId(): Promise<string> {
        return this.page.evaluate(() => document.activeElement?.id ?? "");
    }

    /** True when focus is inside the open dialog (or has left the page for browser UI). */
    focusIsInsideDialog(): Promise<boolean> {
        return this.page.evaluate(() => {
            const active = document.activeElement;
            return !active || active === document.body || !!active.closest("dialog[open]");
        });
    }

    // ── Document / motion ────────────────────────────────────────────────────
    /** Waits until finite CSS animations/transitions have finished (spinners are infinite and ignored). */
    async settle() {
        await this.page.waitForFunction(() =>
            document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
        );
    }

    metadata() {
        return this.page.evaluate(() => {
            const meta = (sel: string) => document.querySelector<HTMLMetaElement>(sel)?.content ?? null;
            return {
                title: document.title,
                description: meta('meta[name="description"]'),
                ogTitle: meta('meta[property="og:title"]'),
                ogDescription: meta('meta[property="og:description"]'),
                ogImage: meta('meta[property="og:image"]'),
                themeColor: meta('meta[name="theme-color"]'),
                icon: document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute("href") ?? null,
            };
        });
    }

    /** Longest computed transition duration on the element, in seconds. */
    transitionSeconds(locator: Locator): Promise<number> {
        return locator.evaluate((el) =>
            Math.max(...getComputedStyle(el).transitionDuration.split(",").map((d) => (d.trim().endsWith("ms") ? parseFloat(d) / 1000 : parseFloat(d)))),
        );
    }
}
