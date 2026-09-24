import type { MxRecord } from "node:dns";
import { loadConfig, type AppConfig } from "../server/config";
import type { DnsClient } from "../server/lib/dns";
import type { CommunityStore } from "../server/lib/community";
import type { CheckContext } from "../server/engine/types";
import { createMemo } from "../server/engine/runner";
import { parseTarget } from "../shared/detect";
import type { Target, TargetType } from "../shared/types";

export const testConfig: AppConfig = loadConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:" } as NodeJS.ProcessEnv);

type Records = Partial<{ A: string[]; AAAA: string[]; MX: MxRecord[]; TXT: string[][]; NS: string[]; PTR: string[] }>;

function dnsError(code: string) {
    return Object.assign(new Error(code), { code });
}

/** In-memory resolver: unknown names are NXDOMAIN, known names without a record type are NODATA. */
export function fakeDns(zone: Record<string, Records | "timeout">): DnsClient {
    const get = <K extends keyof Records>(name: string, type: K): Promise<NonNullable<Records[K]>> => {
        const entry = zone[name];
        if (entry === "timeout") return Promise.reject(dnsError("ETIMEOUT"));
        if (!entry) return Promise.reject(dnsError("ENOTFOUND"));
        const rec = entry[type];
        return rec ? Promise.resolve(rec as NonNullable<Records[K]>) : Promise.reject(dnsError("ENODATA"));
    };
    return {
        resolve4: (h) => get(h, "A"),
        resolve6: (h) => get(h, "AAAA"),
        resolveMx: (h) => get(h, "MX"),
        resolveTxt: (h) => get(h, "TXT"),
        resolveNs: (h) => get(h, "NS"),
        resolveCname: () => Promise.reject(dnsError("ENODATA")),
        reverse: (ip) => get(ip, "PTR"),
    };
}

export function fakeFetch(routes: Record<string, { status?: number; body?: unknown } | ((url: string, init?: RequestInit) => Response)>) {
    const calls: string[] = [];
    const fn = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push(url);
        const key = Object.keys(routes).find((k) => url.startsWith(k));
        if (!key) return new Response("not mocked", { status: 599 });
        const route = routes[key];
        if (typeof route === "function") return route(url, init);
        const body = route.body === undefined ? "" : typeof route.body === "string" ? route.body : JSON.stringify(route.body);
        return new Response(body, { status: route.status ?? 200 });
    }) as typeof fetch;
    return Object.assign(fn, { calls });
}

export const emptyCommunity: CommunityStore = { lookup: async () => ({ reports: null, known: null }) };

export function target(input: string, type?: TargetType): Target {
    const parsed = parseTarget(input, type);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.target;
}

export function ctx(t: Target, overrides: Partial<CheckContext> = {}): CheckContext {
    return {
        target: t,
        signal: new AbortController().signal,
        config: testConfig,
        fetch: fakeFetch({}),
        dns: fakeDns({}),
        community: emptyCommunity,
        memo: createMemo(),
        ...overrides,
    };
}
