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
    "Investigate further": "pivots",
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
        return this.page.getByRole("textbox", { name: "What do you want to investigate?" });
    }

    submitButton(): Locator {
        return this.page.locator("form").getByRole("button", { name: "Investigate" });
    }

    /** Live type badge next to the field; resolves to its label text (e.g. "Email"). */
    typeBadge(): Locator {
        return this.page.locator("form .chip");
    }

    exampleLink(label: (typeof EXAMPLE_LABELS)[number]): Locator {
        return this.page.getByRole("link", { name: label, exact: true });
    }

    // ── Home ─────────────────────────────────────────────────────────────────
    statsRegion(): Locator {
        return this.page.locator("section").filter({ hasText: "Lookups run" });
    }

    async capabilityGroups(): Promise<{ title: string; points: number }[]> {
        const section = this.page.locator("section").filter({ has: this.page.getByRole("heading", { level: 2, name: /intelligence sources/ }) });
        return section.locator("h3").evaluateAll((hs) =>
            hs.map((h) => ({ title: h.textContent?.trim() ?? "", points: h.parentElement?.querySelectorAll("li").length ?? 0 })),
        );
    }

    // ── Results ──────────────────────────────────────────────────────────────
    targetHeading(): Locator {
        return this.page.getByRole("heading", { level: 1 });
    }

    /** Type label in the results header (not the live badge inside the search field). */
    targetType(label: string): Locator {
        return this.page.locator("div.min-w-0", { has: this.targetHeading() }).locator(".chip", { hasText: new RegExp(`^${label}$`) });
    }

    cachedBadge(): Locator {
        return this.page.getByText(/^cached · /);
    }

    lookupError(): Locator {
        return this.page.getByText("Lookup failed");
    }

    copyLinkButton(): Locator {
        return this.page.getByRole("button", { name: "Share" });
    }

    exportJsonButton(): Locator {
        return this.page.getByRole("button", { name: "JSON" });
    }

    refreshButton(): Locator {
        return this.page.getByRole("button", { name: "Re-scan" });
    }

    reportButton(): Locator {
        return this.page.getByRole("button", { name: "Report", exact: true });
    }

    verdict(): Locator {
        return this.page.locator("aside section").first();
    }

    verdictAside(): Locator {
        return this.page.locator("aside").first();
    }

    /** Numeric score once scored, or null while pending. */
    async score(): Promise<number | null> {
        const name = (await this.verdict().getByRole("img", { name: /Risk score|Scoring in progress/ }).getAttribute("aria-label")) ?? "";
        const m = /Risk score (\d+)/.exec(name);
        return m ? Number(m[1]) : null;
    }

    scorePending(): Locator {
        return this.verdict().getByRole("img", { name: "Scoring in progress" });
    }

    verdictLabel(label: string): Locator {
        return this.verdict().getByText(label, { exact: true });
    }

    verdictMeta(): Locator {
        return this.verdict().getByText(/Confidence \d+%/);
    }

    progressText(done: number, total: number): Locator {
        return this.verdict().getByText(`${done} / ${total} sources answered`);
    }

    aiIndicator(): Locator {
        return this.verdict().locator("svg.lucide-sparkles");
    }

    verdictSection(name: "summary" | "redFlags" | "trust" | "recommendations"): Locator {
        const title = { summary: "Assessment", redFlags: "Red flags", trust: "Trust signals", recommendations: "What to do" }[name];
        return this.verdict().locator("div").filter({ has: this.page.getByRole("heading", { level: 3, name: title }) }).last();
    }

    sourceCards(): Locator {
        return this.page.locator("article");
    }

    sourceCard(name: string): Locator {
        return this.page.locator("article").filter({ has: this.page.getByRole("heading", { level: 3, name, exact: true }) });
    }

    pendingSources(): Locator {
        return this.page.getByText("Querying source…");
    }

    async categoryOrder(): Promise<CheckCategory[]> {
        const titles = await this.page.getByRole("main").locator("h2").allTextContents();
        return titles.map((t) => CATEGORY_TITLES[t.trim()]).filter(Boolean);
    }

    notRun(): Locator {
        return this.page.getByText(/^Not run:/);
    }

    showAllButton(count: number): Locator {
        return this.page.getByRole("button", { name: `Show all ${count}` });
    }

    /** Result items (profiles, extracted indicators, pivots) rendered inside a card. */
    cardItems(card: Locator): Locator {
        return card.locator(":scope > div.grid > *");
    }

    cardLink(card: Locator, name: string | RegExp): Locator {
        return card.getByRole("link", { name, exact: typeof name === "string" });
    }

    cardText(card: Locator, text: string | RegExp): Locator {
        return card.getByText(text);
    }

    cardSourceAttribution(card: Locator): Locator {
        return card.locator("footer").getByText(/^Source: |^ScamShield analysis$/);
    }

    cardDuration(card: Locator, ms: number): Locator {
        return card.locator("footer").getByText(`${ms} ms`);
    }

    cardStatus(card: Locator, label: string): Locator {
        return card.locator("header").getByText(label, { exact: true });
    }

    /** In-app link produced by a source (e.g. an indicator extracted from a message). */
    internalLink(href: string): Locator {
        return this.page.locator(`a[href="${href}"]`);
    }

    durationBadge(): Locator {
        return this.page.getByText(/^\d+\.\d s$/);
    }

    // ── Report dialog ────────────────────────────────────────────────────────
    reportDialog(): Locator {
        return this.page.getByRole("dialog");
    }

    categoryOption(c: ReportCategory): Locator {
        return this.reportDialog().getByRole("button", { name: c, exact: true });
    }

    categoryOptions(): Locator {
        return this.reportDialog().locator("button[type=button].capitalize");
    }

    async selectedCategory(): Promise<string | null> {
        return this.categoryOptions().evaluateAll((bs) => {
            const pressed = bs.find((b) => b.getAttribute("aria-checked") === "true" || b.getAttribute("aria-pressed") === "true" || b.className.includes("bg-rose-500/15"));
            return pressed?.textContent?.trim() ?? null;
        });
    }

    reportDescription(): Locator {
        return this.reportDialog().getByLabel(/What happened/);
    }

    submitReportButton(): Locator {
        return this.reportDialog().getByRole("button", { name: "Submit report" });
    }

    // ── Sources / API ────────────────────────────────────────────────────────
    sourceRow(name: string): Locator {
        return this.page.getByRole("main").locator("div.flex-col").filter({ has: this.page.getByText(name, { exact: true }) }).first();
    }

    sourceUpstreamLink(row: Locator, name: string): Locator {
        return row.getByRole("link", { name, exact: true });
    }

    rowText(row: Locator, text: string | RegExp): Locator {
        return row.getByText(text);
    }

    aiSummariesFlag(): Locator {
        return this.page.getByText(/AI-written summaries: enabled/);
    }

    /**
     * Opens the API docs page. Loading /api directly currently returns the server's JSON 404
     * (the Express API router is mounted at /api, audit #32), so it is reached via the nav
     * link the way users get there today. P5 fixes the route; then this becomes a plain goto.
     */
    async gotoApiDocs() {
        await this.page.goto("/definitely-not-a-page");
        await this.navLink("API").click();
        await this.page.getByRole("heading", { level: 1, name: "API" }).waitFor();
    }

    async endpointPaths(): Promise<string[]> {
        return this.page.getByRole("main").locator("code").filter({ hasText: /^\/api\// }).allTextContents();
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
