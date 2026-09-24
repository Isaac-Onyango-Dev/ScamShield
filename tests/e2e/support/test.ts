import { test as base, expect, type Page } from "@playwright/test";
import type { DashboardStats, SourceInfo } from "../../../shared/types";
import { App } from "./app";

type StreamBody = string | ((url: URL, call: number) => string);

interface StreamOptions {
    status?: number;
    headers?: Record<string, string>;
    /** Holds the response for the given (1-based) call until the promise settles. */
    gate?: (call: number) => Promise<unknown> | undefined;
}

/**
 * Browser-side API mocks. A catch-all route answers every /api request that no
 * specific mock handled with HTTP 599 and records it; the fixture then fails the test.
 * Result: no e2e test can ever reach a live OSINT source or depend on server state.
 */
export class Api {
    readonly unmocked: string[] = [];
    readonly streamUrls: URL[] = [];
    readonly reportBodies: unknown[] = [];
    statsCalls = 0;

    constructor(private readonly page: Page) {}

    async install() {
        // Registered first, so every later (more specific) route takes precedence.
        await this.page.route("**/api/**", (route) => {
            this.unmocked.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
            return route.fulfill({ status: 599, contentType: "application/json", body: JSON.stringify({ error: "unmocked" }) });
        });
    }

    async stream(body: StreamBody, opts: StreamOptions = {}) {
        await this.page.route((url) => url.pathname === "/api/lookup/stream", async (route) => {
            const url = new URL(route.request().url());
            this.streamUrls.push(url);
            const call = this.streamUrls.length;
            await opts.gate?.(call);
            const status = opts.status ?? 200;
            await route.fulfill({
                status,
                headers: { "content-type": status === 200 ? "text/event-stream; charset=utf-8" : "application/json", ...opts.headers },
                body: typeof body === "function" ? body(url, call) : body,
            });
        });
    }

    async stats(json: DashboardStats) {
        await this.page.route("**/api/stats", (route) => {
            this.statsCalls++;
            return route.fulfill({ json });
        });
    }

    async sources(json: { sources: SourceInfo[]; aiSummaries: boolean }) {
        await this.page.route("**/api/sources", (route) => route.fulfill({ json }));
    }

    async report(status: number, json: Record<string, unknown>) {
        await this.page.route("**/api/reports", (route) => {
            this.reportBodies.push(route.request().postDataJSON());
            return route.fulfill({ status, json });
        });
    }
}

export const test = base.extend<{ api: Api; app: App }>({
    api: async ({ page }, use) => {
        const api = new Api(page);
        await api.install();
        await use(api);
        expect(api.unmocked, "every /api request must be mocked").toEqual([]);
    },
    app: async ({ page }, use) => {
        await use(new App(page));
    },
});

export { expect };
