import { test as base, expect, type Page } from "@playwright/test";
import type { DashboardStats, SourceInfo, StreamEvent } from "../../../shared/types";
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

/**
 * Scripted EventSource for states a one-shot HTTP mock can't produce (a lookup that is still
 * streaming). Installed before the app loads; the test pushes events one by one.
 */
export async function useScriptedStream(page: Page) {
    await page.addInitScript(() => {
        type Listener = ((e: { data: string }) => void) | null;
        class ScriptedEventSource {
            onmessage: Listener = null;
            onerror: (() => void) | null = null;
            readyState = 1;
            constructor(readonly url: string) {
                (window as unknown as { __streams: ScriptedEventSource[] }).__streams.push(this);
            }
            close() {
                this.readyState = 2;
            }
        }
        (window as unknown as { __streams: unknown[] }).__streams = [];
        (window as unknown as { EventSource: unknown }).EventSource = ScriptedEventSource;
    });
    return {
        emit: (event: StreamEvent) =>
            page.evaluate((e) => {
                const streams = (window as unknown as { __streams: { onmessage: ((m: { data: string }) => void) | null }[] }).__streams;
                streams[streams.length - 1].onmessage?.({ data: JSON.stringify(e) });
            }, event),
        urls: () => page.evaluate(() => (window as unknown as { __streams: { url: string }[] }).__streams.map((s) => s.url)),
    };
}

/**
 * Serves the app with a different storage mode in <meta name="scamshield-storage"> (the server
 * fills it from STORAGE_PERSISTENT). "unrendered" leaves the raw placeholder, as a static host would.
 */
export async function setStorageMode(page: Page, mode: "ephemeral" | "persistent" | "unrendered") {
    await page.route(
        (url) => !url.pathname.startsWith("/api/"),
        async (route) => {
            if (route.request().resourceType() !== "document") return route.fallback();
            const res = await route.fetch();
            const value = mode === "unrendered" ? "%STORAGE_MODE%" : mode;
            const body = (await res.text()).replace(/(<meta name="scamshield-storage" content=")[^"]*(")/, `$1${value}$2`);
            await route.fulfill({ response: res, body });
        },
    );
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
