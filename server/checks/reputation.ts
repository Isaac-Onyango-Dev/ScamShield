import type { CheckContext, CheckDefinition } from "../engine/types";
import type { Fact, Item, Severity, Signal } from "../../shared/types";
import { tryDns } from "../lib/dns";
import { requestJson } from "../lib/http";
import { hostInfo } from "../lib/domain";
import { isIPv4 } from "../../shared/detect";
import { hasCustomDomain, formatDate, risk, statusFromSignals, targetHost, plural } from "./util";

/** Answer interpretation for a DNS blocklist zone. */
interface Dnsbl {
    zone: string;
    name: string;
    url: string;
    /** Returns a listing description + severity, "refused" for resolver-policy answers, or null when not listed. */
    decode(ip: string): { label: string; severity: Severity } | "refused" | null;
}

const SPAMHAUS_DBL: Dnsbl = {
    zone: "dbl.spamhaus.org",
    name: "Spamhaus DBL",
    url: "https://check.spamhaus.org",
    decode(ip) {
        if (ip.startsWith("127.255.255.")) return "refused";
        const map: Record<string, [string, Severity]> = {
            "127.0.1.2": ["spam domain", "high"],
            "127.0.1.4": ["phishing domain", "critical"],
            "127.0.1.5": ["malware domain", "critical"],
            "127.0.1.6": ["botnet C&C domain", "critical"],
            "127.0.1.102": ["abused legitimate domain (spam)", "medium"],
            "127.0.1.103": ["abused redirector", "medium"],
            "127.0.1.104": ["abused legitimate domain (phishing)", "high"],
            "127.0.1.105": ["abused legitimate domain (malware)", "high"],
            "127.0.1.106": ["abused legitimate domain (botnet C&C)", "high"],
        };
        const hit = map[ip];
        return hit ? { label: hit[0], severity: hit[1] } : ip.startsWith("127.0.1.") ? { label: "listed", severity: "high" } : null;
    },
};

const SURBL: Dnsbl = {
    zone: "multi.surbl.org",
    name: "SURBL",
    url: "https://surbl.org/surbl-analysis",
    decode(ip) {
        if (!ip.startsWith("127.0.0.")) return null;
        const bits = Number(ip.split(".")[3]);
        if (bits === 1) return "refused";
        const tags = [bits & 8 && "phishing", bits & 16 && "malware", bits & 64 && "abuse", bits & 128 && "cracked site"].filter(Boolean);
        if (!tags.length) return null;
        return { label: tags.join(", "), severity: bits & (8 | 16) ? "critical" : "high" };
    },
};

const URIBL: Dnsbl = {
    zone: "multi.uribl.com",
    name: "URIBL",
    url: "https://admin.uribl.com",
    decode(ip) {
        if (!ip.startsWith("127.0.0.")) return null;
        const bits = Number(ip.split(".")[3]);
        if (bits === 1) return "refused";
        if (bits & 2) return { label: "black (active spam/phishing)", severity: "high" };
        if (bits & 8) return { label: "red (monitored abuse)", severity: "medium" };
        if (bits & 4) return { label: "grey (bulk mail)", severity: "low" };
        return null;
    },
};

const SPAMHAUS_ZEN: Dnsbl = {
    zone: "zen.spamhaus.org",
    name: "Spamhaus ZEN",
    url: "https://check.spamhaus.org",
    decode(ip) {
        if (ip.startsWith("127.255.255.")) return "refused";
        const last = Number(ip.split(".")[3]);
        if (last === 2 || last === 9) return { label: "SBL/DROP — spam or hijacked network", severity: "high" };
        if (last === 3) return { label: "CSS — snowshoe spam source", severity: "medium" };
        if (last >= 4 && last <= 7) return { label: "XBL — compromised host / botnet", severity: "high" };
        if (last === 10 || last === 11) return null; // PBL: dynamic end-user range, a policy list — not evidence of abuse
        return null;
    },
};

const SPAMCOP: Dnsbl = {
    zone: "bl.spamcop.net",
    name: "SpamCop",
    url: "https://www.spamcop.net/bl.shtml",
    decode: (ip) => (ip === "127.0.0.2" ? { label: "reported spam source", severity: "medium" } : null),
};

const DRONEBL: Dnsbl = {
    zone: "dnsbl.dronebl.org",
    name: "DroneBL",
    url: "https://dronebl.org/lookup",
    decode: (ip) => (ip.startsWith("127.0.0.") ? { label: "abusable/compromised host (proxy, drone, scanner)", severity: "high" } : null),
};

export function reverseIp(ip: string): string {
    if (isIPv4(ip)) return ip.split(".").reverse().join(".");
    // Expand IPv6 to 32 nibbles and reverse them.
    const [head, tail = ""] = ip.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const groups = [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
    return groups
        .map((g) => g.padStart(4, "0"))
        .join("")
        .split("")
        .reverse()
        .join(".");
}

async function queryLists(ctx: CheckContext, name: string, lists: Dnsbl[]) {
    const results = await Promise.all(
        lists.map(async (list) => {
            const out = await tryDns(() => ctx.dns.resolve4(`${name}.${list.zone}`));
            if (!out.ok) {
                return out.code === "ERROR" ? { list, state: "error" as const } : { list, state: "clean" as const };
            }
            const decoded = out.records.map((r) => list.decode(r)).filter(Boolean);
            if (decoded.includes("refused")) return { list, state: "refused" as const };
            const hit = decoded.find((d) => d && d !== "refused") as { label: string; severity: Severity } | undefined;
            return hit ? { list, state: "listed" as const, hit } : { list, state: "clean" as const };
        }),
    );

    const facts: Fact[] = results.map((r) => ({
        label: r.list.name,
        value:
            r.state === "listed"
                ? `LISTED — ${r.hit!.label}`
                : r.state === "refused"
                  ? "unavailable from this resolver"
                  : r.state === "error"
                    ? "lookup failed"
                    : "not listed",
        href: r.list.url,
    }));
    const signals: Signal[] = results
        .filter((r) => r.state === "listed")
        .map((r) => risk(`dnsbl.${r.list.zone}`, r.hit!.severity, `Listed on ${r.list.name}: ${r.hit!.label}`));
    const answered = results.filter((r) => r.state === "clean" || r.state === "listed").length;
    if (!answered) throw new Error("No blocklist answered (resolver may be blocked by list operators)");
    const listed = signals.length;
    return {
        status: statusFromSignals(signals),
        summary: listed ? `Listed on ${plural(listed, "blocklist")}` : `Clean on ${answered}/${lists.length} blocklists`,
        facts,
        signals,
    };
}

export const domainBlocklistCheck: CheckDefinition = {
    id: "domain.blocklists",
    name: "Domain blocklists",
    category: "reputation",
    appliesTo: ["email", "domain", "url"],
    supports: hasCustomDomain,
    source: { name: "Spamhaus DBL · SURBL · URIBL", url: "https://www.spamhaus.org/blocklists/domain-blocklist/" },
    run: (ctx) => queryLists(ctx, hostInfo(targetHost(ctx.target)!).registrable!, [SPAMHAUS_DBL, SURBL, URIBL]),
};

export const ipBlocklistCheck: CheckDefinition = {
    id: "ip.blocklists",
    name: "IP blocklists",
    category: "reputation",
    appliesTo: ["ip"],
    source: { name: "Spamhaus ZEN · SpamCop · DroneBL", url: "https://www.spamhaus.org/blocklists/zen-blocklist/" },
    run: (ctx) =>
        queryLists(ctx, reverseIp(ctx.target.normalized), isIPv4(ctx.target.normalized) ? [SPAMHAUS_ZEN, SPAMCOP, DRONEBL] : [SPAMHAUS_ZEN]),
};

interface SafeBrowsingResponse {
    matches?: { threatType: string; platformType: string; threat: { url: string } }[];
}

export const safeBrowsingCheck: CheckDefinition = {
    id: "reputation.safebrowsing",
    name: "Google Safe Browsing",
    category: "reputation",
    appliesTo: ["domain", "url"],
    source: { name: "Google Safe Browsing", url: "https://safebrowsing.google.com" },
    disabledReason: (c) => (c.GOOGLE_SAFE_BROWSING_KEY ? undefined : "Requires GOOGLE_SAFE_BROWSING_KEY"),
    async run({ target, fetch, signal, config }) {
        const urls =
            target.type === "url" ? [target.normalized] : [`http://${target.normalized}/`, `https://${target.normalized}/`];
        const data = await requestJson<SafeBrowsingResponse>(
            fetch,
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(config.GOOGLE_SAFE_BROWSING_KEY!)}`,
            {
                method: "POST",
                signal,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    client: { clientId: "scamshield", clientVersion: "2.0.0" },
                    threatInfo: {
                        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                        platformTypes: ["ANY_PLATFORM"],
                        threatEntryTypes: ["URL"],
                        threatEntries: urls.map((url) => ({ url })),
                    },
                }),
            },
        );
        const matches = data?.matches ?? [];
        if (!matches.length) return { status: "clean", summary: "Not flagged by Google Safe Browsing" };
        const types = [...new Set(matches.map((m) => m.threatType.replace(/_/g, " ").toLowerCase()))];
        return {
            status: "danger",
            summary: `Flagged as ${types.join(", ")}`,
            facts: [{ label: "Threat types", value: types.join(", ") }],
            signals: [risk("reputation.safebrowsing", "critical", `Google Safe Browsing flags this as ${types.join(", ")}`)],
        };
    },
};

interface UrlhausHost {
    query_status: string;
    url_count?: string | number;
    firstseen?: string;
    urls?: { url: string; url_status: string; threat: string; date_added: string; tags: string[] | null; urlhaus_reference: string }[];
}

export const urlhausCheck: CheckDefinition = {
    id: "reputation.urlhaus",
    name: "URLhaus malware feed",
    category: "reputation",
    appliesTo: ["domain", "url", "ip"],
    source: { name: "abuse.ch URLhaus", url: "https://urlhaus.abuse.ch" },
    disabledReason: (c) => (c.URLHAUS_AUTH_KEY ? undefined : "Requires URLHAUS_AUTH_KEY (free at auth.abuse.ch)"),
    async run({ target, fetch, signal, config }) {
        const host = target.type === "ip" ? target.normalized : targetHost(target)!;
        const data = await requestJson<UrlhausHost>(fetch, "https://urlhaus-api.abuse.ch/v1/host/", {
            method: "POST",
            signal,
            headers: { "Auth-Key": config.URLHAUS_AUTH_KEY!, "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ host }).toString(),
        });
        if (!data || data.query_status === "no_results") return { status: "clean", summary: "No malware URLs recorded on this host" };
        if (data.query_status !== "ok") throw new Error(`URLhaus: ${data.query_status}`);
        const urls = data.urls ?? [];
        const online = urls.filter((u) => u.url_status === "online").length;
        const items: Item[] = urls.slice(0, 10).map((u) => ({
            title: u.url,
            subtitle: `${u.threat} · ${u.url_status}`,
            date: formatDate(u.date_added),
            tags: u.tags ?? [],
            href: u.urlhaus_reference,
        }));
        const signals = [
            online
                ? risk("reputation.urlhaus", "critical", `${plural(online, "live malware URL")} currently hosted here (URLhaus)`)
                : risk("reputation.urlhaus", "medium", `Hosted ${plural(urls.length, "malware URL")} in the past (URLhaus)`),
        ];
        return {
            status: "danger",
            summary: `${plural(Number(data.url_count ?? urls.length), "malware URL")} recorded (${online} online)`,
            facts: [
                { label: "Malware URLs", value: String(data.url_count ?? urls.length) },
                { label: "First seen", value: formatDate(data.firstseen) },
            ],
            items,
            signals,
        };
    },
};
