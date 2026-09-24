import tls from "node:tls";
import type { CheckDefinition, CheckContext } from "../engine/types";
import type { Fact, Item, Signal } from "../../shared/types";
import { recordsOf, tryDns } from "../lib/dns";
import { requestJson } from "../lib/http";
import { hostInfo } from "../lib/domain";
import { isPublicIp } from "../lib/netguard";
import { analyzeHost } from "./lookalike";
import { daysBetween, formatDate, hasCustomDomain, hasDomainHost, humanAge, risk, statusFromSignals, targetHost, trust } from "./util";

const MAIL_PROVIDERS: [RegExp, string][] = [
    [/google(mail)?\.com$|aspmx/i, "Google Workspace / Gmail"],
    [/(protection\.)?outlook\.com$|hotmail\.com$/i, "Microsoft 365 / Outlook"],
    [/zoho\.(com|eu|in)$/i, "Zoho Mail"],
    [/protonmail\.ch$|proton\.me$/i, "Proton Mail"],
    [/yahoodns\.net$/i, "Yahoo Mail"],
    [/icloud\.com$|me\.com$/i, "Apple iCloud Mail"],
    [/pphosted\.com$/i, "Proofpoint"],
    [/mimecast\.com$/i, "Mimecast"],
    [/messagelabs\.com$/i, "Broadcom Email Security"],
    [/mx\.cloudflare\.net$/i, "Cloudflare Email Routing"],
    [/secureserver\.net$/i, "GoDaddy"],
    [/privateemail\.com$|registrar-servers\.com$/i, "Namecheap"],
    [/yandex\.(net|ru)$/i, "Yandex Mail"],
    [/mail\.ru$/i, "Mail.ru"],
    [/fastmail\.com$|messagingengine\.com$/i, "Fastmail"],
    [/amazonaws\.com$|amazonses\.com$/i, "Amazon SES / WorkMail"],
    [/improvmx\.com$/i, "ImprovMX forwarding"],
    [/forwardemail\.net$/i, "Forward Email"],
    [/mailgun\.org$/i, "Mailgun"],
    [/sendgrid\.net$/i, "SendGrid"],
];

export function mailProvider(mx: string[]): string | undefined {
    for (const host of mx) for (const [re, name] of MAIL_PROVIDERS) if (re.test(host)) return name;
    return undefined;
}

const txtJoin = (records: string[][]) => records.map((r) => r.join(""));

export function resolveA(ctx: CheckContext, host: string) {
    return ctx.memo(`dns:A:${host}`, () => tryDns(() => ctx.dns.resolve4(host)));
}

export const dnsCheck: CheckDefinition = {
    id: "dns",
    name: "DNS & email authentication",
    category: "infrastructure",
    appliesTo: ["email", "domain", "url"],
    supports: hasDomainHost,
    async run(ctx) {
        const { target, dns } = ctx;
        const host = targetHost(target)!;
        const mailDomain = target.type === "email" ? host : hostInfo(host).registrable ?? host;
        const [a, aaaa, mx, ns, spfTxt, dmarcTxt] = await Promise.all([
            resolveA(ctx, host),
            tryDns(() => dns.resolve6(host)),
            tryDns(() => dns.resolveMx(mailDomain)),
            tryDns(() => dns.resolveNs(hostInfo(host).registrable ?? host)),
            tryDns(() => dns.resolveTxt(mailDomain)),
            tryDns(() => dns.resolveTxt(`_dmarc.${mailDomain}`)),
        ]);

        const signals: Signal[] = [];
        const facts: Fact[] = [];
        const nx = !a.ok && a.code === "NXDOMAIN" && !mx.ok && (mx as { code: string }).code === "NXDOMAIN";

        if (nx) {
            signals.push(
                target.type === "email"
                    ? risk("dns.nxdomain", "high", `Email domain ${host} does not exist — this address cannot be real`)
                    : risk("dns.nxdomain", "medium", `${host} does not resolve (unregistered or taken down)`),
            );
            return { status: "danger", summary: "Domain does not exist in DNS", facts: [{ label: "Host", value: host, mono: true }], signals };
        }

        const ipv4 = recordsOf(a);
        const ipv6 = recordsOf(aaaa);
        const mxHosts = recordsOf(mx).sort((x, y) => x.priority - y.priority).map((m) => m.exchange);
        const nullMx = mxHosts.length === 1 && (mxHosts[0] === "" || mxHosts[0] === ".");
        const spf = txtJoin(recordsOf(spfTxt)).find((t) => /^v=spf1/i.test(t));
        const dmarc = txtJoin(recordsOf(dmarcTxt)).find((t) => /^v=DMARC1/i.test(t));
        const dmarcPolicy = dmarc?.match(/;\s*p=(\w+)/i)?.[1]?.toLowerCase();
        const provider = mailProvider(mxHosts);

        if (target.type !== "email") {
            facts.push({ label: "IPv4", value: ipv4.slice(0, 4).join(", ") || "none", mono: true });
            if (ipv6.length) facts.push({ label: "IPv6", value: ipv6.slice(0, 2).join(", "), mono: true });
        }
        facts.push({ label: "Mail servers", value: nullMx ? "Null MX (refuses mail)" : mxHosts.slice(0, 3).join(", ") || "none", mono: true });
        if (provider) facts.push({ label: "Mail provider", value: provider });
        facts.push({ label: "SPF", value: spf ?? "missing", mono: !!spf });
        facts.push({ label: "DMARC", value: dmarc ? `policy=${dmarcPolicy ?? "?"}` : "missing" });
        const nsHosts = recordsOf(ns);
        if (nsHosts.length) facts.push({ label: "Nameservers", value: nsHosts.slice(0, 3).join(", "), mono: true });

        if (target.type === "email") {
            if (nullMx) signals.push(risk("dns.null-mx", "high", "Domain publishes a null MX — it can never receive email"));
            else if (!mxHosts.length && !ipv4.length) signals.push(risk("dns.no-mx", "high", "Email domain has no mail servers — replies will bounce"));
            if (!spf && !dmarc) signals.push(risk("dns.no-auth", "low", "No SPF or DMARC — anyone can spoof mail from this domain"));
        }
        if (spf && /[+]all\b/i.test(spf)) signals.push(risk("dns.spf-all", "medium", "SPF '+all' authorizes the entire internet to send as this domain"));
        if (dmarcPolicy === "reject" || dmarcPolicy === "quarantine") {
            signals.push(trust("dns.dmarc-enforced", "low", `DMARC enforced (p=${dmarcPolicy}) — spoofing is blocked`));
        }
        if (target.type !== "email" && !ipv4.length && !ipv6.length) {
            signals.push(risk("dns.no-address", "low", "Domain exists but points to no web server"));
        }

        return {
            status: statusFromSignals(signals, "info"),
            summary: provider ? `Mail handled by ${provider}` : mxHosts.length ? "Domain resolves and accepts mail" : "Domain resolves",
            facts,
            signals,
        };
    },
};

interface RdapEntity {
    roles?: string[];
    vcardArray?: [string, [string, Record<string, unknown>, string, string | string[]][]];
    publicIds?: { type: string; identifier: string }[];
    entities?: RdapEntity[];
}
interface RdapDomain {
    ldhName?: string;
    status?: string[];
    events?: { eventAction: string; eventDate: string }[];
    entities?: RdapEntity[];
    nameservers?: { ldhName?: string }[];
    secureDNS?: { delegationSigned?: boolean };
}

export function vcardValue(entity: RdapEntity | undefined, field: string): string | undefined {
    const entry = entity?.vcardArray?.[1]?.find((e) => e[0] === field);
    const v = entry?.[3];
    return Array.isArray(v) ? v.filter(Boolean).join(" ") : v || undefined;
}

export function findEntity(entities: RdapEntity[] | undefined, role: string): RdapEntity | undefined {
    for (const e of entities ?? []) {
        if (e.roles?.includes(role)) return e;
        const nested = findEntity(e.entities, role);
        if (nested) return nested;
    }
    return undefined;
}

export const rdapDomainCheck: CheckDefinition = {
    id: "domain.rdap",
    name: "Domain registration",
    category: "infrastructure",
    appliesTo: ["email", "domain", "url"],
    supports: hasCustomDomain,
    source: { name: "RDAP (IANA bootstrap via rdap.org)", url: "https://about.rdap.org" },
    async run({ target, fetch, signal }) {
        const domain = hostInfo(targetHost(target)!).registrable!;
        const data = await requestJson<RdapDomain>(fetch, `https://rdap.org/domain/${domain}`, {
            signal,
            notFound: [404],
            headers: { accept: "application/rdap+json, application/json" },
        });
        if (!data) {
            return {
                status: "info",
                summary: "No RDAP record (the registry may not support RDAP)",
                facts: [{ label: "Domain", value: domain, mono: true }],
            };
        }

        const event = (action: string) => data.events?.find((e) => e.eventAction === action)?.eventDate;
        const created = event("registration");
        const expires = event("expiration");
        const changed = event("last changed");
        const registrar = findEntity(data.entities, "registrar");
        const status = data.status ?? [];

        const facts: Fact[] = [
            { label: "Domain", value: domain, mono: true },
            { label: "Registrar", value: vcardValue(registrar, "fn") ?? "—" },
            { label: "Registered", value: formatDate(created) },
            { label: "Expires", value: formatDate(expires) },
        ];
        if (changed) facts.push({ label: "Last changed", value: formatDate(changed) });
        if (status.length) facts.push({ label: "Status", value: status.join(", ") });
        if (data.secureDNS?.delegationSigned !== undefined) {
            facts.push({ label: "DNSSEC", value: data.secureDNS.delegationSigned ? "signed" : "unsigned" });
        }

        const signals: Signal[] = [];
        let summary = "Registration data retrieved";
        if (created) {
            const days = daysBetween(new Date(created), new Date());
            facts.splice(3, 0, { label: "Age", value: humanAge(days) });
            summary = `Registered ${humanAge(days)} ago`;
            if (days < 30) signals.push(risk("domain.age", "high", `Domain registered only ${humanAge(days)} ago`));
            else if (days < 90) signals.push(risk("domain.age", "medium", `Domain registered ${humanAge(days)} ago`));
            else if (days < 365) signals.push(risk("domain.age", "low", `Domain is less than a year old (${humanAge(days)})`));
            else if (days >= 5 * 365) signals.push(trust("domain.age", "medium", `Domain has existed for ${humanAge(days)}`));
            else if (days >= 2 * 365) signals.push(trust("domain.age", "low", `Domain has existed for ${humanAge(days)}`));
        }
        if (status.some((s) => /hold/i.test(s))) {
            signals.push(risk("domain.hold", "high", "Registry/registrar has put the domain on hold (common after abuse reports)"));
        }
        if (status.some((s) => /redemption|pending delete/i.test(s))) {
            signals.push(risk("domain.expiring", "medium", "Domain is expired / pending deletion"));
        }

        return { status: statusFromSignals(signals, "info"), summary, facts, signals };
    },
};

export const lookalikeCheck: CheckDefinition = {
    id: "domain.lookalike",
    name: "Impersonation & typosquatting",
    category: "reputation",
    appliesTo: ["email", "domain", "url"],
    supports: hasCustomDomain,
    async run({ target }) {
        const host = targetHost(target)!;
        const analysis = analyzeHost(host);
        const facts: Fact[] = [{ label: "Host", value: host, mono: true }];
        if (analysis.unicode !== host) facts.push({ label: "Displays as", value: analysis.unicode });
        if (analysis.impersonates) {
            facts.push({ label: "Imitates", value: analysis.impersonates.name });
            facts.push({
                label: "Real domain",
                value: analysis.impersonates.domains[0],
                href: `https://${analysis.impersonates.domains[0]}`,
            });
        }
        if (analysis.official) facts.push({ label: "Verified brand", value: analysis.official.name });
        const signals = analysis.signals;
        return {
            status: analysis.official ? "clean" : statusFromSignals(signals),
            summary: analysis.official
                ? `Official ${analysis.official.name} domain`
                : analysis.impersonates
                  ? `Imitates ${analysis.impersonates.name}`
                  : signals.length
                    ? `${signals.length} structural red flag${signals.length > 1 ? "s" : ""}`
                    : "No impersonation patterns detected",
            facts,
            signals,
        };
    },
};

interface CertInfo {
    authorized: boolean;
    authorizationError?: string;
    protocol: string | null;
    subject?: string;
    issuer?: string;
    validFrom: string;
    validTo: string;
    altNames: string[];
}

function probeTls(ip: string, servername: string, signal: AbortSignal): Promise<CertInfo> {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({ host: ip, port: 443, servername, rejectUnauthorized: false, timeout: 6000 });
        const done = (err?: Error) => {
            signal.removeEventListener("abort", onAbort);
            socket.destroy();
            if (err) reject(err);
        };
        const onAbort = () => done(new Error("Aborted"));
        signal.addEventListener("abort", onAbort, { once: true });
        socket.once("secureConnect", () => {
            const cert = socket.getPeerCertificate();
            const info: CertInfo = {
                authorized: socket.authorized,
                authorizationError: socket.authorizationError ? String(socket.authorizationError) : undefined,
                protocol: socket.getProtocol(),
                subject: [cert.subject?.CN].flat().filter(Boolean).join(", ") || undefined,
                issuer: [cert.issuer?.O, cert.issuer?.CN].filter(Boolean).join(" — "),
                validFrom: cert.valid_from,
                validTo: cert.valid_to,
                altNames: (cert.subjectaltname ?? "").split(",").map((s) => s.trim().replace(/^DNS:/, "")).filter(Boolean),
            };
            done();
            resolve(info);
        });
        socket.once("timeout", () => done(new Error("TLS handshake timed out")));
        socket.once("error", (err) => done(err));
    });
}

export const tlsCheck: CheckDefinition = {
    id: "domain.tls",
    name: "TLS certificate",
    category: "infrastructure",
    appliesTo: ["domain", "url"],
    supports: hasDomainHost,
    timeoutMs: 9000,
    async run(ctx) {
        const host = targetHost(ctx.target)!;
        const ips = recordsOf(await resolveA(ctx, host));
        if (!ips.length) return { status: "skipped", summary: "Host has no IPv4 address to probe" };
        const ip = ips.find(isPublicIp);
        if (!ip) {
            return {
                status: "warning",
                summary: "Host resolves to a private/reserved address — not probed",
                signals: [risk("tls.private-ip", "medium", "Public domain points to a private or reserved IP address")],
            };
        }

        let cert: CertInfo;
        try {
            cert = await probeTls(ip, host, ctx.signal);
        } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === "ECONNREFUSED" || code === "ECONNRESET" || /timed out/i.test((err as Error).message)) {
                return {
                    status: "warning",
                    summary: "No HTTPS service on port 443",
                    signals: [risk("tls.none", "low", "Site does not serve HTTPS")],
                };
            }
            throw err;
        }

        const signals: Signal[] = [];
        const issued = new Date(cert.validFrom);
        const expires = new Date(cert.validTo);
        const ageDays = daysBetween(issued, new Date());
        const facts: Fact[] = [
            { label: "Subject", value: cert.subject ?? "—", mono: true },
            { label: "Issuer", value: cert.issuer || "—" },
            { label: "Valid", value: `${formatDate(issued)} → ${formatDate(expires)}` },
            { label: "Protocol", value: cert.protocol ?? "—" },
            { label: "Probed IP", value: ip, mono: true },
        ];
        if (cert.altNames.length) {
            facts.push({ label: "Covers", value: `${cert.altNames.slice(0, 4).join(", ")}${cert.altNames.length > 4 ? ` +${cert.altNames.length - 4} more` : ""}`, mono: true });
        }

        if (!cert.authorized) {
            signals.push(risk("tls.invalid", "medium", `Invalid certificate (${cert.authorizationError ?? "untrusted"})`));
        } else if (ageDays >= 0 && ageDays <= 3) {
            signals.push(risk("tls.fresh", "low", `Certificate issued ${humanAge(ageDays)} ago — site may be brand new`));
        }
        const items: Item[] = [
            { title: "Certificate transparency history", subtitle: "crt.sh", href: `https://crt.sh/?q=${encodeURIComponent(host)}` },
        ];
        return {
            status: statusFromSignals(signals, "clean"),
            summary: cert.authorized ? `Valid certificate from ${cert.issuer?.split(" — ")[0] || "trusted CA"}` : "Certificate is not trusted",
            facts,
            items,
            signals,
        };
    },
};
