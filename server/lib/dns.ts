import { Resolver } from "node:dns/promises";
import type { MxRecord } from "node:dns";

export interface DnsClient {
    resolve4(host: string): Promise<string[]>;
    resolve6(host: string): Promise<string[]>;
    resolveMx(host: string): Promise<MxRecord[]>;
    resolveTxt(host: string): Promise<string[][]>;
    resolveNs(host: string): Promise<string[]>;
    resolveCname(host: string): Promise<string[]>;
    reverse(ip: string): Promise<string[]>;
}

export function createDnsClient(servers?: string): DnsClient {
    const resolver = new Resolver({ timeout: 1500, tries: 2 });
    if (servers) resolver.setServers(servers.split(",").map((s) => s.trim()).filter(Boolean));
    return {
        resolve4: (h) => resolver.resolve4(h),
        resolve6: (h) => resolver.resolve6(h),
        resolveMx: (h) => resolver.resolveMx(h),
        resolveTxt: (h) => resolver.resolveTxt(h),
        resolveNs: (h) => resolver.resolveNs(h),
        resolveCname: (h) => resolver.resolveCname(h),
        reverse: (ip) => resolver.reverse(ip),
    };
}

export type DnsOutcome<T> =
    | { ok: true; records: T[] }
    | { ok: false; code: "NXDOMAIN" | "NODATA" | "ERROR"; message: string };

/** Normalizes resolver errors: NXDOMAIN and NODATA are answers, not failures. */
export async function tryDns<T>(fn: () => Promise<T[]>): Promise<DnsOutcome<T>> {
    try {
        return { ok: true, records: await fn() };
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOTFOUND") return { ok: false, code: "NXDOMAIN", message: "Domain does not exist" };
        if (code === "ENODATA") return { ok: false, code: "NODATA", message: "No records" };
        return { ok: false, code: "ERROR", message: code ?? (err as Error).message };
    }
}

export function recordsOf<T>(outcome: DnsOutcome<T>): T[] {
    return outcome.ok ? outcome.records : [];
}
