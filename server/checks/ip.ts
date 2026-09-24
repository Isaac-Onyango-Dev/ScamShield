import type { CheckDefinition } from "../engine/types";
import type { Fact, Signal } from "../../shared/types";
import { requestJson } from "../lib/http";
import { tryDns, recordsOf } from "../lib/dns";
import { classifyIp } from "../lib/netguard";
import { findEntity, vcardValue } from "./domain";
import { formatDate, risk, statusFromSignals } from "./util";

interface RdapIp {
    handle?: string;
    name?: string;
    country?: string;
    startAddress?: string;
    endAddress?: string;
    type?: string;
    entities?: Parameters<typeof findEntity>[0];
    events?: { eventAction: string; eventDate: string }[];
}

const HOSTING_RE =
    /amazon|aws|google|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai|vultr|choopa|contabo|leaseweb|m247|alibaba|tencent|oracle|cloudflare|scaleway|hostinger|godaddy|ionos|datacamp|psychz|hostwinds|colocrossing|frantech|buyvm|servers\.com|kamatera/i;

export const ipNetworkCheck: CheckDefinition = {
    id: "ip.network",
    name: "Network ownership",
    category: "infrastructure",
    appliesTo: ["ip"],
    source: { name: "RDAP (regional internet registries) + reverse DNS", url: "https://about.rdap.org" },
    async run({ target, fetch, signal, dns }) {
        const ip = target.normalized;
        const cls = classifyIp(ip);
        if (cls !== "public") {
            return {
                status: "info",
                summary: `${cls} address — not routable on the public internet`,
                facts: [{ label: "Address class", value: cls }],
            };
        }
        const [rdap, ptr] = await Promise.all([
            requestJson<RdapIp>(fetch, `https://rdap.org/ip/${ip}`, { signal, notFound: [404], headers: { accept: "application/rdap+json" } }),
            tryDns(() => dns.reverse(ip)),
        ]);
        const org =
            vcardValue(findEntity(rdap?.entities, "registrant"), "fn") ?? vcardValue(findEntity(rdap?.entities, "administrative"), "fn");
        const abuse = findEntity(rdap?.entities, "abuse");
        const hostnames = recordsOf(ptr);
        const facts: Fact[] = [
            { label: "Network", value: [rdap?.name, rdap?.handle].filter(Boolean).join(" · ") || "—", mono: true },
            { label: "Organization", value: org ?? "—" },
            { label: "Country", value: rdap?.country ?? "—" },
            { label: "Range", value: rdap?.startAddress ? `${rdap.startAddress} – ${rdap.endAddress}` : "—", mono: true },
            { label: "Reverse DNS", value: hostnames.slice(0, 2).join(", ") || "none", mono: true },
        ];
        const abuseEmail = vcardValue(abuse, "email");
        if (abuseEmail) facts.push({ label: "Abuse contact", value: abuseEmail, href: `mailto:${abuseEmail}` });
        const registered = rdap?.events?.find((e) => e.eventAction === "registration")?.eventDate;
        if (registered) facts.push({ label: "Allocated", value: formatDate(registered) });

        const hosting = HOSTING_RE.test(`${org ?? ""} ${rdap?.name ?? ""} ${hostnames.join(" ")}`);
        if (hosting) facts.push({ label: "Network type", value: "Datacenter / cloud hosting" });
        const signals: Signal[] = [];
        return {
            status: statusFromSignals(signals, "info"),
            summary: `${org ?? rdap?.name ?? "Unknown network"}${rdap?.country ? ` (${rdap.country})` : ""}`,
            facts,
            signals,
        };
    },
};

interface AbuseIpDbResponse {
    data?: {
        abuseConfidenceScore: number;
        totalReports: number;
        numDistinctUsers: number;
        lastReportedAt: string | null;
        usageType?: string;
        isp?: string;
        domain?: string;
        countryCode?: string;
        isTor?: boolean;
        isWhitelisted?: boolean;
    };
}

export const abuseIpDbCheck: CheckDefinition = {
    id: "ip.abuseipdb",
    name: "AbuseIPDB",
    category: "reputation",
    appliesTo: ["ip"],
    source: { name: "AbuseIPDB", url: "https://www.abuseipdb.com" },
    disabledReason: (c) => (c.ABUSEIPDB_API_KEY ? undefined : "Requires ABUSEIPDB_API_KEY"),
    async run({ target, fetch, signal, config }) {
        const res = await requestJson<AbuseIpDbResponse>(
            fetch,
            `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(target.normalized)}&maxAgeInDays=90`,
            { signal, headers: { Key: config.ABUSEIPDB_API_KEY! } },
        );
        const d = res?.data;
        if (!d) throw new Error("Empty AbuseIPDB response");
        const signals: Signal[] = [];
        if (d.abuseConfidenceScore >= 75) signals.push(risk("ip.abuse", "critical", `AbuseIPDB confidence ${d.abuseConfidenceScore}% (${d.totalReports} reports)`));
        else if (d.abuseConfidenceScore >= 25) signals.push(risk("ip.abuse", "high", `AbuseIPDB confidence ${d.abuseConfidenceScore}% (${d.totalReports} reports)`));
        else if (d.totalReports > 0) signals.push(risk("ip.abuse", "low", `${d.totalReports} abuse reports in the last 90 days`));
        if (d.isTor) signals.push(risk("ip.tor", "medium", "Tor exit node — traffic origin is anonymized"));
        return {
            status: statusFromSignals(signals),
            summary: `Abuse confidence ${d.abuseConfidenceScore}% · ${d.totalReports} reports (90d)`,
            facts: [
                { label: "Confidence of abuse", value: `${d.abuseConfidenceScore}%` },
                { label: "Reports (90d)", value: `${d.totalReports} from ${d.numDistinctUsers} users` },
                { label: "Last reported", value: formatDate(d.lastReportedAt) },
                { label: "Usage type", value: d.usageType ?? "—" },
                { label: "ISP", value: d.isp ?? "—" },
            ],
            signals,
        };
    },
};
