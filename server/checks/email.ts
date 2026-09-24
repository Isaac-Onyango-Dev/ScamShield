import crypto from "node:crypto";
import type { CheckDefinition } from "../engine/types";
import type { Fact, Item, Signal } from "../../shared/types";
import { requestJson, requestStatus } from "../lib/http";
import { isDisposableDomain, isFreeProvider, officialBrandFor } from "../lib/domain";
import { BRANDS, ROLE_ACCOUNTS } from "../data/lists";
import { matchBrand } from "./lookalike";
import { formatDate, plural, risk, statusFromSignals, trust } from "./util";

function splitEmail(email: string) {
    const at = email.lastIndexOf("@");
    return { local: email.slice(0, at), domain: email.slice(at + 1) };
}

/** Heuristic for machine-generated local parts like "xk2q9wz81" or "user8472615". */
export function looksRandom(local: string): boolean {
    const s = local.replace(/[._+-]/g, "").toLowerCase();
    if (s.length < 8) return false;
    const letters = s.replace(/[^a-z]/g, "");
    const digits = s.replace(/\D/g, "").length;
    const vowels = letters.replace(/[^aeiouy]/g, "").length;
    const longestConsonantRun = Math.max(0, ...(letters.match(/[^aeiouy]+/g) ?? []).map((r) => r.length));
    return (
        (letters.length >= 6 && vowels / letters.length < 0.18) ||
        longestConsonantRun >= 6 ||
        (digits >= 5 && digits / s.length >= 0.35 && s.length >= 10)
    );
}

/** Brands whose name appears in the local part, e.g. "paypal.support" or "applesecurity". */
export function brandsInLocalPart(local: string) {
    const tokens = local.toLowerCase().split(/[._+\-\d]+/).filter(Boolean);
    const compact = tokens.join("");
    return BRANDS.filter((b) =>
        [b.key, ...(b.aliases ?? [])].some((k) => {
            const hit = matchBrand(k.replace(/-/g, ""), compact, tokens, compact, compact);
            return hit === "exact" || hit === "embedded";
        }),
    );
}

export const emailIdentityCheck: CheckDefinition = {
    id: "email.identity",
    name: "Address analysis",
    category: "identity",
    appliesTo: ["email"],
    async run({ target }) {
        const { local, domain } = splitEmail(target.normalized);
        const signals: Signal[] = [];
        const facts: Fact[] = [{ label: "Address", value: target.normalized, mono: true }];

        const disposable = isDisposableDomain(domain);
        const free = isFreeProvider(domain);
        // Webmail domains (gmail.com, outlook.com) belong to a brand but anyone can sign up.
        const official = free || disposable ? undefined : officialBrandFor(domain);
        const baseLocal = local.split("+")[0];
        const tag = local.includes("+") ? local.slice(local.indexOf("+") + 1) : null;
        const role = ROLE_ACCOUNTS.has(baseLocal) || ROLE_ACCOUNTS.has(baseLocal.replace(/[._-]/g, ""));

        facts.push({
            label: "Provider type",
            value: disposable ? "Disposable / temporary" : free ? "Free webmail" : "Custom / organizational domain",
        });
        if (official) facts.push({ label: "Belongs to", value: official.name });
        facts.push({ label: "Role account", value: role ? `Yes (${baseLocal})` : "No" });
        if (tag) facts.push({ label: "Sub-address tag", value: `+${tag}`, mono: true });
        if (domain === "gmail.com" || domain === "googlemail.com") {
            facts.push({ label: "Canonical Gmail", value: `${baseLocal.replace(/\./g, "")}@gmail.com`, mono: true });
        }

        if (disposable) signals.push(risk("email.disposable", "high", "Disposable (throwaway) email provider"));

        const brands = brandsInLocalPart(baseLocal).filter((b) => b !== official);
        if (brands.length && (free || disposable)) {
            signals.push(
                risk("email.brand-on-free", "high", `Free mailbox pretending to be ${brands[0].name} ("${baseLocal}@${domain}")`),
            );
        } else if (role && free) {
            signals.push(risk("email.role-on-free", "medium", `Official-sounding role name ("${baseLocal}") on a free webmail account`));
        }

        if (looksRandom(baseLocal)) signals.push(risk("email.random-local", "low", "Local part looks machine-generated"));
        if (official) signals.push(trust("email.official-domain", "medium", `Address is on an official ${official.name} domain`));

        return {
            status: statusFromSignals(signals, "info"),
            summary: disposable
                ? "Temporary inbox — commonly used to avoid accountability"
                : free
                  ? `Free webmail address${role ? " using a role name" : ""}`
                  : "Address on a custom domain",
            facts,
            signals,
        };
    },
};

interface GravatarProfile {
    display_name?: string;
    profile_url?: string;
    avatar_url?: string;
    location?: string;
    description?: string;
    job_title?: string;
    company?: string;
    pronunciation?: string;
    verified_accounts?: { service_type?: string; service_label?: string; url?: string; is_hidden?: boolean }[];
    registration_date?: string;
}

export const gravatarCheck: CheckDefinition = {
    id: "email.gravatar",
    name: "Gravatar profile",
    category: "identity",
    appliesTo: ["email"],
    source: { name: "Gravatar", url: "https://gravatar.com" },
    async run({ target, fetch, signal, config }) {
        const hash = crypto.createHash("sha256").update(target.normalized.trim().toLowerCase()).digest("hex");
        const profile = await requestJson<GravatarProfile>(fetch, `https://api.gravatar.com/v3/profiles/${hash}`, {
            signal,
            notFound: [404],
            headers: config.GRAVATAR_API_KEY ? { authorization: `Bearer ${config.GRAVATAR_API_KEY}` } : undefined,
        });
        if (!profile) return { status: "clean", summary: "No public Gravatar profile" };

        const facts: Fact[] = [];
        if (profile.display_name) facts.push({ label: "Display name", value: profile.display_name });
        if (profile.job_title || profile.company) {
            facts.push({ label: "Work", value: [profile.job_title, profile.company].filter(Boolean).join(" @ ") });
        }
        if (profile.location) facts.push({ label: "Location", value: profile.location });
        if (profile.registration_date) facts.push({ label: "Member since", value: formatDate(profile.registration_date) });
        if (profile.profile_url) facts.push({ label: "Profile", value: profile.profile_url, href: profile.profile_url });
        if (profile.description) facts.push({ label: "Bio", value: profile.description.slice(0, 280) });

        const accounts = (profile.verified_accounts ?? []).filter((a) => !a.is_hidden && a.url);
        const items: Item[] = accounts.map((a) => ({
            title: a.service_label ?? a.service_type ?? "Linked account",
            subtitle: a.url,
            href: a.url,
            tags: ["verified link"],
        }));
        if (profile.avatar_url) items.unshift({ title: "Avatar", image: profile.avatar_url, href: profile.avatar_url });

        return {
            status: "found",
            summary: `Public profile${profile.display_name ? ` for "${profile.display_name}"` : ""} with ${plural(accounts.length, "linked account")}`,
            facts,
            items,
            signals: [
                accounts.length >= 2
                    ? trust("email.gravatar", "medium", `Gravatar profile with ${accounts.length} verified linked accounts`)
                    : trust("email.gravatar", "low", "Has a public Gravatar profile"),
            ],
        };
    },
};

interface XonBreach {
    breach: string;
    domain?: string;
    industry?: string;
    xposed_date?: string;
    xposed_data?: string;
    xposed_records?: number;
    password_risk?: string;
    verified?: string;
}
interface XonAnalytics {
    ExposedBreaches?: { breaches_details?: XonBreach[] } | null;
    Error?: string;
}

function breachHistorySignal(years: number[]): Signal[] {
    if (!years.length) return [];
    const earliest = Math.min(...years);
    const age = new Date().getUTCFullYear() - earliest;
    if (age >= 3) return [trust("email.history", "medium", `Address has existed since at least ${earliest} (breach history)`)];
    if (age >= 1) return [trust("email.history", "low", `Address active since at least ${earliest}`)];
    return [];
}

export const xposedOrNotCheck: CheckDefinition = {
    id: "email.breaches",
    name: "Data breaches",
    category: "exposure",
    appliesTo: ["email"],
    source: { name: "XposedOrNot", url: "https://xposedornot.com" },
    async run({ target, fetch, signal }) {
        const data = await requestJson<XonAnalytics>(
            fetch,
            `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(target.normalized)}`,
            { signal, notFound: [404] },
        );
        const breaches = data?.ExposedBreaches?.breaches_details ?? [];
        if (!breaches.length) return { status: "clean", summary: "Not found in any known data breach" };

        const sorted = [...breaches].sort((a, b) => Number(b.xposed_date ?? 0) - Number(a.xposed_date ?? 0));
        const years = sorted.map((b) => Number(b.xposed_date)).filter((y) => y > 1990);
        const dataTypes = [...new Set(sorted.flatMap((b) => (b.xposed_data ?? "").split(";").map((s) => s.trim())))].filter(
            Boolean,
        );
        const plaintext = sorted.filter((b) => /plain/i.test(b.password_risk ?? "")).length;

        const facts: Fact[] = [
            { label: "Breaches", value: String(sorted.length) },
            { label: "First seen", value: years.length ? String(Math.min(...years)) : "—" },
            { label: "Most recent", value: years.length ? String(Math.max(...years)) : "—" },
            { label: "Exposed data", value: dataTypes.slice(0, 8).join(", ") || "—" },
        ];
        if (plaintext) facts.push({ label: "Plaintext passwords", value: `${plaintext} breach(es)` });

        return {
            status: "found",
            summary: `Exposed in ${plural(sorted.length, "breach", "breaches")}${years.length ? ` (${Math.min(...years)}–${Math.max(...years)})` : ""}`,
            facts,
            items: sorted.slice(0, 50).map((b) => ({
                title: b.breach,
                subtitle: [b.domain, b.industry, b.xposed_records ? `${b.xposed_records.toLocaleString("en-US")} records` : null]
                    .filter(Boolean)
                    .join(" · "),
                date: b.xposed_date,
                tags: (b.xposed_data ?? "").split(";").map((s) => s.trim()).filter(Boolean).slice(0, 4),
                href: b.domain ? `https://${b.domain}` : undefined,
            })),
            signals: breachHistorySignal(years),
        };
    },
};

interface HibpBreach {
    Name: string;
    Title: string;
    Domain: string;
    BreachDate: string;
    PwnCount: number;
    DataClasses: string[];
    IsVerified: boolean;
}

export const hibpCheck: CheckDefinition = {
    id: "email.hibp",
    name: "Have I Been Pwned",
    category: "exposure",
    appliesTo: ["email"],
    source: { name: "Have I Been Pwned", url: "https://haveibeenpwned.com" },
    disabledReason: (c) => (c.HIBP_API_KEY ? undefined : "Requires HIBP_API_KEY"),
    async run({ target, fetch, signal, config }) {
        const breaches = await requestJson<HibpBreach[]>(
            fetch,
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(target.normalized)}?truncateResponse=false`,
            { signal, notFound: [404], headers: { "hibp-api-key": config.HIBP_API_KEY! } },
        );
        if (!breaches?.length) return { status: "clean", summary: "Not found in any HIBP breach" };
        const years = breaches.map((b) => Number(b.BreachDate.slice(0, 4)));
        return {
            status: "found",
            summary: `Exposed in ${plural(breaches.length, "breach", "breaches")}`,
            facts: [
                { label: "Breaches", value: String(breaches.length) },
                { label: "First seen", value: String(Math.min(...years)) },
            ],
            items: breaches
                .sort((a, b) => b.BreachDate.localeCompare(a.BreachDate))
                .map((b) => ({
                    title: b.Title,
                    subtitle: `${b.Domain || "unknown domain"} · ${b.PwnCount.toLocaleString("en-US")} accounts`,
                    date: b.BreachDate,
                    tags: b.DataClasses.slice(0, 4),
                    href: `https://haveibeenpwned.com/PwnedWebsites#${b.Name}`,
                })),
            signals: breachHistorySignal(years),
        };
    },
};

interface HudsonRockStealer {
    date_compromised?: string;
    stealer_family?: string;
    computer_name?: string;
    operating_system?: string;
    total_corporate_services?: number;
    total_user_services?: number;
    antiviruses?: string[] | string;
}
interface HudsonRockResponse {
    message?: string;
    stealers?: HudsonRockStealer[];
}

export const infostealerCheck: CheckDefinition = {
    id: "email.infostealer",
    name: "Infostealer malware logs",
    category: "exposure",
    appliesTo: ["email"],
    source: { name: "Hudson Rock Cavalier", url: "https://www.hudsonrock.com/free-tools" },
    async run({ target, fetch, signal }) {
        const data = await requestJson<HudsonRockResponse>(
            fetch,
            `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email?email=${encodeURIComponent(target.normalized)}`,
            { signal, notFound: [404] },
        );
        const stealers = data?.stealers ?? [];
        if (!stealers.length) return { status: "clean", summary: "Not found in infostealer infection logs" };

        const latest = stealers
            .map((s) => s.date_compromised)
            .filter(Boolean)
            .sort()
            .pop();
        return {
            status: "danger",
            summary: `Credentials found in ${plural(stealers.length, "infected device log")}`,
            facts: [
                { label: "Infected devices", value: String(stealers.length) },
                { label: "Latest compromise", value: formatDate(latest) },
            ],
            items: stealers.map((s) => ({
                title: `${s.stealer_family ?? "Unknown"} infostealer`,
                subtitle: [s.operating_system, s.computer_name ? `host ${s.computer_name}` : null].filter(Boolean).join(" · "),
                date: formatDate(s.date_compromised),
                tags: [`${(s.total_user_services ?? 0) + (s.total_corporate_services ?? 0)} saved logins`],
            })),
            signals: [
                risk(
                    "email.infostealer",
                    "medium",
                    "Account credentials were stolen by malware — messages from it may come from an attacker",
                ),
            ],
        };
    },
};

export const pgpCheck: CheckDefinition = {
    id: "email.pgp",
    name: "PGP public key",
    category: "identity",
    appliesTo: ["email"],
    source: { name: "keys.openpgp.org", url: "https://keys.openpgp.org" },
    async run({ target, fetch, signal }) {
        const status = await requestStatus(
            fetch,
            `https://keys.openpgp.org/vks/v1/by-email/${encodeURIComponent(target.normalized)}`,
            { signal },
        );
        if (status === 404) return { status: "clean", summary: "No verified PGP key published" };
        if (status !== 200) throw new Error(`Keyserver responded ${status}`);
        const href = `https://keys.openpgp.org/search?q=${encodeURIComponent(target.normalized)}`;
        return {
            status: "found",
            summary: "Owner published and verified a PGP key for this address",
            facts: [{ label: "Key", value: "View on keys.openpgp.org", href }],
            signals: [trust("email.pgp", "low", "Verified PGP key published for this address")],
        };
    },
};

interface GithubCommitSearch {
    total_count: number;
    items: {
        html_url: string;
        repository: { full_name: string; html_url: string };
        author: { login: string; html_url: string; avatar_url: string } | null;
        commit: { author: { name: string; date: string }; message: string };
    }[];
}

export const githubCheck: CheckDefinition = {
    id: "email.github",
    name: "GitHub activity",
    category: "identity",
    appliesTo: ["email"],
    source: { name: "GitHub", url: "https://github.com" },
    async run({ target, fetch, signal, config }) {
        const headers: Record<string, string> = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
        if (config.GITHUB_TOKEN) headers.authorization = `Bearer ${config.GITHUB_TOKEN}`;
        const q = encodeURIComponent(`author-email:${target.normalized}`);
        const data = await requestJson<GithubCommitSearch>(
            fetch,
            `https://api.github.com/search/commits?q=${q}&sort=author-date&order=desc&per_page=10`,
            { signal, headers },
        );
        if (!data?.total_count) return { status: "clean", summary: "No public commits authored with this address" };

        const logins = [...new Set(data.items.map((i) => i.author?.login).filter(Boolean))] as string[];
        const names = [...new Set(data.items.map((i) => i.commit.author.name))];
        const repos = [...new Set(data.items.map((i) => i.repository.full_name))];
        const dates = data.items.map((i) => i.commit.author.date).sort();
        const facts: Fact[] = [
            { label: "Public commits", value: data.total_count.toLocaleString("en-US") },
            { label: "Author names", value: names.slice(0, 5).join(", ") },
        ];
        for (const login of logins.slice(0, 3)) {
            facts.push({ label: "GitHub account", value: `@${login}`, href: `https://github.com/${login}` });
        }
        return {
            status: "found",
            summary: `${plural(data.total_count, "public commit")} across ${plural(repos.length, "repository", "repositories")}`,
            facts,
            items: data.items.slice(0, 8).map((i) => ({
                title: i.repository.full_name,
                subtitle: i.commit.message.split("\n")[0].slice(0, 120),
                date: formatDate(i.commit.author.date),
                href: i.html_url,
                image: i.author?.avatar_url,
            })),
            signals: [
                trust(
                    "email.github",
                    data.total_count >= 20 ? "medium" : "low",
                    `Public GitHub activity since ${formatDate(dates[0])}`,
                ),
            ],
        };
    },
};
