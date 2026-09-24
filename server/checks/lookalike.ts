import { domainToUnicode } from "node:url";
import type { Signal } from "../../shared/types";
import { BRANDS, HIGH_ABUSE_TLDS, PHISHING_KEYWORDS, URL_SHORTENERS, type Brand } from "../data/lists";
import { hostInfo, officialBrandFor } from "../lib/domain";
import { risk, trust } from "./util";

/** Common visual/character substitutions used in typosquats. */
const CONFUSABLES: Record<string, string> = {
    "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "$": "s", "@": "a",
    // Cyrillic / Greek letters that render like Latin ones
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j", "ѕ": "s",
    "ԁ": "d", "ɡ": "g", "ӏ": "l", "һ": "h", "ո": "n", "ս": "u", "ν": "v", "ο": "o", "α": "a", "ε": "e",
    "κ": "k", "τ": "t", "ρ": "p", "ι": "i",
};

export function skeleton(s: string): string {
    return [...s.toLowerCase()]
        .map((ch) => CONFUSABLES[ch] ?? ch)
        .join("")
        .replace(/rn/g, "m")
        .replace(/vv/g, "w")
        .replace(/ii/g, "u");
}

export function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = tmp;
        }
    }
    return prev[b.length];
}

function scriptsOf(s: string): Set<string> {
    const scripts = new Set<string>();
    for (const ch of s) {
        if (/[a-z]/i.test(ch)) scripts.add("latin");
        else if (/\p{Script=Cyrillic}/u.test(ch)) scripts.add("cyrillic");
        else if (/\p{Script=Greek}/u.test(ch)) scripts.add("greek");
        else if (/\p{L}/u.test(ch)) scripts.add("other");
    }
    return scripts;
}

const brandKeys = (b: Brand) => [b.key, ...(b.aliases ?? [])].map((k) => k.replace(/-/g, ""));

/** Words phishers glue onto brand names ("paypal-secure-login"). */
const FILLERS = [
    ...PHISHING_KEYWORDS.map((k) => k.replace(/-/g, "")),
    "online", "service", "services", "app", "apps", "help", "team", "official", "my", "id", "pay", "web",
    "mail", "center", "centre", "portal", "bank", "banking", "cloud", "customer", "care", "gift", "promo",
    "ltd", "inc", "corp", "hq", "global", "int", "net", "info", "user", "users", "access", "check", "safe",
    "store", "shop", "live", "now", "hub", "desk", "form", "forms", "alert", "alerts", "notice", "team",
    "us", "uk", "usa", "eu", "ke", "ng", "in", "go", "get", "the", "www", "sso", "mfa", "otp", "pin",
];

/** True if `s` can be fully segmented into filler words (dynamic programming). */
export function isFiller(s: string): boolean {
    if (!s) return true;
    const ok = [true, ...Array(s.length).fill(false)];
    for (let i = 1; i <= s.length; i++) {
        for (const w of FILLERS) {
            if (w.length <= i && ok[i - w.length] && s.slice(i - w.length, i) === w) {
                ok[i] = true;
                break;
            }
        }
    }
    return ok[s.length];
}

type BrandHit = "exact" | "embedded" | "homoglyph" | "typo" | null;

export function matchBrand(key: string, label: string, tokens: string[], compact: string, skel: string): BrandHit {
    if (label === key || compact === key) return "exact";
    if (tokens.includes(key)) return "embedded";
    // Brand glued to filler words: "paypalsecurelogin", "loginapple", "appleid-verify".
    const i = compact.indexOf(key);
    if (key.length >= 4 && i >= 0 && isFiller(compact.slice(0, i)) && isFiller(compact.slice(i + key.length))) {
        return "embedded";
    }
    if (key.length >= 5 && skel !== compact) {
        const j = skel.indexOf(key);
        if (j >= 0 && isFiller(skel.slice(0, j)) && isFiller(skel.slice(j + key.length))) return "homoglyph";
    }
    if (key.length >= 5 && Math.abs(compact.length - key.length) <= 2) {
        const d = levenshtein(compact, key);
        if (d > 0 && d <= (key.length >= 8 ? 2 : 1)) return "typo";
    }
    return null;
}

interface HostAnalysis {
    signals: Signal[];
    official?: Brand;
    impersonates?: Brand;
    unicode: string;
    shortener: boolean;
}

/** Pure hostname risk analysis — reused by the domain, email and message checks. */
export function analyzeHost(host: string): HostAnalysis {
    const signals: Signal[] = [];
    const info = hostInfo(host);
    const unicode = host.includes("xn--") ? domainToUnicode(host) : host;
    const official = officialBrandFor(host);
    const shortener = URL_SHORTENERS.has(host) || (!!info.registrable && URL_SHORTENERS.has(info.registrable));

    if (official) {
        signals.push(trust("host.official-brand", "high", `Official ${official.name} domain`));
        return { signals, official, unicode, shortener };
    }
    if (!info.registrable || !info.label) return { signals, unicode, shortener };

    const label = info.label.toLowerCase();
    const unicodeLabel = unicode.split(".").slice(0, label.split(".").length).join(".");
    const tokens = label.split(/[-.\d]+/).filter(Boolean);
    const compact = label.replace(/[-.]/g, "");
    const skel = skeleton(label.includes("xn--") ? unicodeLabel : label).replace(/[-.]/g, "");
    const subTokens = info.subdomain.toLowerCase().split(/[.-]+/).filter(Boolean);
    let impersonates: Brand | undefined;

    for (const brand of BRANDS) {
        for (const key of brandKeys(brand)) {
            const hit = matchBrand(key, label, tokens, compact, skel);
            if (hit === "exact") {
                signals.push(risk("host.brand-wrong-tld", "high", `Uses the ${brand.name} name on an unofficial domain (${info.registrable})`));
            } else if (hit === "embedded") {
                signals.push(risk("host.brand-embedded", "high", `Contains "${key}" but is not an official ${brand.name} domain`));
            } else if (hit === "homoglyph") {
                signals.push(risk("host.homoglyph", "high", `Disguises "${key}" with look-alike characters (${unicode})`));
            } else if (hit === "typo") {
                signals.push(risk("host.typosquat", key.length >= 8 ? "high" : "medium", `Resembles ${brand.name} ("${label}" vs "${key}")`));
            } else if (subTokens.includes(key)) {
                const withDomain = brand.domains.some((d) => info.subdomain.includes(d));
                signals.push(
                    risk("host.brand-subdomain", withDomain ? "high" : "medium", `Puts "${withDomain ? brand.domains.find((d) => info.subdomain.includes(d)) : key}" in the subdomain to look like ${brand.name}`),
                );
            } else continue;
            impersonates = brand;
            break;
        }
        if (impersonates) break;
    }

    if (host.includes("xn--")) {
        const scripts = scriptsOf(unicode.replace(/\./g, ""));
        if (scripts.size > 1) {
            signals.push(risk("host.mixed-script", "high", `Internationalized domain mixing ${[...scripts].join(" + ")} characters (${unicode})`));
        } else {
            signals.push(risk("host.idn", "low", `Internationalized (punycode) domain: ${unicode}`));
        }
    }

    const keywordHits = PHISHING_KEYWORDS.filter((k) => host.includes(k));
    if (keywordHits.length >= 2) {
        signals.push(risk("host.phish-keywords", "medium", `Hostname stacks phishing vocabulary: ${keywordHits.slice(0, 4).join(", ")}`));
    } else if (keywordHits.length === 1 && impersonates) {
        signals.push(risk("host.phish-keywords", "medium", `Brand name combined with "${keywordHits[0]}"`));
    }

    if (info.tld && HIGH_ABUSE_TLDS.has(info.tld)) {
        signals.push(risk("host.abused-tld", "low", `.${info.tld} is a TLD heavily used in abuse campaigns`));
    }
    if ((label.match(/-/g) ?? []).length >= 3) signals.push(risk("host.hyphens", "low", "Unusually many hyphens in domain"));
    if (compact.length > 30) signals.push(risk("host.long", "low", "Unusually long domain name"));
    if (info.subdomain.split(".").filter(Boolean).length >= 4) {
        signals.push(risk("host.deep-subdomain", "low", "Deeply nested subdomains"));
    }

    return { signals, impersonates, unicode, shortener };
}
