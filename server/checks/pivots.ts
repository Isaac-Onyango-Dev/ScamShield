import type { CheckDefinition } from "../engine/types";
import type { Item, Target } from "../../shared/types";
import { hostInfo } from "../lib/domain";
import { parsePhone } from "./phone";

const e = encodeURIComponent;

/**
 * Hand-off links to specialist tools for deeper manual investigation.
 * Nothing is fetched — these are just well-formed deep links.
 */
export function pivotsFor(target: Target, region: string): Item[] {
    const v = target.normalized;
    switch (target.type) {
        case "email": {
            const domain = target.host!;
            return [
                { title: "Google (exact match)", href: `https://www.google.com/search?q=${e(`"${v}"`)}`, tags: ["search"] },
                { title: "Epieos", subtitle: "Google account & service registrations", href: `https://epieos.com/?q=${e(v)}&t=email`, tags: ["accounts"] },
                { title: "Have I Been Pwned", href: `https://haveibeenpwned.com/`, tags: ["breaches"] },
                { title: "Intelligence X", href: `https://intelx.io/?s=${e(v)}`, tags: ["leaks"] },
                { title: "GitHub commits", href: `https://github.com/search?q=${e(v)}&type=commits`, tags: ["code"] },
                { title: `Investigate ${domain}`, href: `/search?q=${e(domain)}`, tags: ["pivot"] },
            ];
        }
        case "domain":
        case "url": {
            const host = target.host!;
            const reg = hostInfo(host).registrable ?? host;
            const items: Item[] = [
                { title: "VirusTotal", href: target.type === "url" ? `https://www.virustotal.com/gui/search/${e(e(v))}` : `https://www.virustotal.com/gui/domain/${e(host)}`, tags: ["reputation"] },
                { title: "urlscan.io", subtitle: "Screenshots & page behaviour", href: `https://urlscan.io/search/#domain:${e(host)}`, tags: ["sandbox"] },
                { title: "crt.sh", subtitle: "Certificate transparency", href: `https://crt.sh/?q=${e(reg)}`, tags: ["certs"] },
                { title: "Wayback Machine", href: `https://web.archive.org/web/*/${e(host)}`, tags: ["history"] },
                { title: "WHOIS / RDAP", href: `https://lookup.icann.org/en/lookup?name=${e(reg)}`, tags: ["registration"] },
                { title: "Google Transparency Report", href: `https://transparencyreport.google.com/safe-browsing/search?url=${e(host)}`, tags: ["reputation"] },
            ];
            if (target.type === "url") items.push({ title: `Investigate ${host}`, href: `/search?q=${e(host)}`, tags: ["pivot"] });
            return items;
        }
        case "ip":
            return [
                { title: "Shodan", subtitle: "Open ports & services", href: `https://www.shodan.io/host/${e(v)}`, tags: ["exposure"] },
                { title: "AbuseIPDB", href: `https://www.abuseipdb.com/check/${e(v)}`, tags: ["reputation"] },
                { title: "GreyNoise", subtitle: "Internet scanner classification", href: `https://viz.greynoise.io/ip/${e(v)}`, tags: ["reputation"] },
                { title: "VirusTotal", href: `https://www.virustotal.com/gui/ip-address/${e(v)}`, tags: ["reputation"] },
                { title: "Censys", href: `https://search.censys.io/hosts/${e(v)}`, tags: ["exposure"] },
                { title: "ipinfo.io", href: `https://ipinfo.io/${e(v)}`, tags: ["geo"] },
            ];
        case "phone": {
            const pn = parsePhone(target.input, region);
            const digits = (pn?.number ?? v).replace(/\D/g, "");
            const items: Item[] = [
                { title: "Google (all formats)", href: `https://www.google.com/search?q=${e(`"${pn?.formatInternational() ?? v}" OR "${pn?.formatNational() ?? v}" OR "${digits}"`)}`, tags: ["search"] },
                { title: "WhatsApp", subtitle: "Check if the number has an account", href: `https://wa.me/${digits}`, tags: ["messaging"] },
                { title: "Telegram", href: `https://t.me/+${digits}`, tags: ["messaging"] },
                { title: "Tellows", subtitle: "Community caller ratings", href: `https://www.tellows.com/num/${digits}`, tags: ["reputation"] },
            ];
            if (pn?.country) {
                items.push({ title: "Truecaller", href: `https://www.truecaller.com/search/${pn.country.toLowerCase()}/${pn.nationalNumber}`, tags: ["caller id"] });
            }
            if (pn?.country === "US" || pn?.country === "CA") {
                items.push({ title: "800notes", href: `https://800notes.com/Phone.aspx/1-${pn.nationalNumber.slice(0, 3)}-${pn.nationalNumber.slice(3, 6)}-${pn.nationalNumber.slice(6)}`, tags: ["reputation"] });
            }
            return items;
        }
        case "text": {
            const snippet = v.split(/[.!?\n]/).find((s) => s.trim().length > 20)?.trim().slice(0, 90) ?? v.slice(0, 90);
            return [
                { title: "Search this wording", subtitle: "Scam scripts are reused verbatim", href: `https://www.google.com/search?q=${e(`"${snippet}"`)}`, tags: ["search"] },
                { title: "Report to the FTC (US)", href: "https://reportfraud.ftc.gov/", tags: ["report"] },
                { title: "Report to Action Fraud (UK)", href: "https://www.actionfraud.police.uk/", tags: ["report"] },
            ];
        }
    }
}

export const pivotsCheck: CheckDefinition = {
    id: "pivots",
    name: "Investigate further",
    category: "pivots",
    appliesTo: ["email", "domain", "url", "ip", "phone", "text"],
    async run({ target, config }) {
        const items = pivotsFor(target, config.DEFAULT_PHONE_REGION);
        return { status: "info", summary: `${items.length} specialist tools`, items };
    },
};
