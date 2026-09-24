import type { CheckResult, DashboardStats, LookupReport, SourceInfo, Target } from "../../../shared/types";

/**
 * Typed fixtures shared by the e2e specs. They import the real API types, so `npm run check`
 * fails if the contract in shared/types.ts drifts away from what the tests exercise.
 */

// 1×1 PNG; CSP allows data: images, so avatars never hit the network.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const MESSAGE =
    "URGENT: Your account has been suspended. Verify your identity within 24 hours at http://amaz0n-verify.top/login or pay the release fee in gift cards.";

export const messageTarget: Target = { type: "text", input: MESSAGE, normalized: MESSAGE };

const community: CheckResult = {
    id: "community",
    name: "Community reports",
    category: "community",
    status: "clean",
    summary: "No community reports yet",
    facts: [],
    signals: [],
    source: { name: "ScamShield community", url: "/sources" },
    durationMs: 9,
};

const lookalike: CheckResult = {
    id: "lookalike",
    name: "Lookalike analysis",
    category: "reputation",
    status: "warning",
    summary: "Brand impersonation patterns found",
    facts: [{ label: "Closest brand", value: "amazon" }],
    signals: [{ id: "lookalike.brand", label: "Brand name combined with \"verify\"", kind: "risk", severity: "medium" }],
    durationMs: 4,
};

const message: CheckResult = {
    id: "text.message",
    name: "Scam language analysis",
    category: "content",
    status: "danger",
    summary: "7 manipulation tactics detected, 1 indicator(s) extracted",
    facts: [
        { label: "Length", value: "149 characters" },
        { label: "First link", value: "http://amaz0n-verify.top/login", mono: true, href: "https://urlscan.io/search/#amaz0n-verify.top" },
    ],
    items: [{ title: "amaz0n-verify.top", subtitle: "http://amaz0n-verify.top/login", href: "/search?q=amaz0n-verify.top", tags: ["link"] }],
    signals: [
        { id: "text.credentials", label: "Asks for passwords, PINs or verification codes", kind: "risk", severity: "critical" },
        { id: "text.payment", label: "Demands untraceable payment (gift cards, crypto, wire)", kind: "risk", severity: "high" },
        { id: "text.urgency", label: "Artificial urgency or deadline", kind: "risk", severity: "medium" },
        { id: "text.greeting", label: "No generic greeting", kind: "trust", severity: "low" },
    ],
    durationMs: 6,
};

const profiles: CheckResult = {
    id: "email.gravatar",
    name: "Public profiles",
    category: "identity",
    status: "found",
    summary: "7 public profiles",
    facts: [],
    items: Array.from({ length: 7 }, (_, i) => ({
        title: `Profile ${i + 1}`,
        subtitle: `Account on service ${i + 1}`,
        href: `https://profiles.example.test/${i + 1}`,
        tags: ["verified"],
        date: `2024-0${(i % 9) + 1}-01`,
        image: PIXEL,
    })),
    signals: [],
    source: { name: "Gravatar", url: "https://gravatar.com" },
    durationMs: 312,
};

const breaches: CheckResult = {
    id: "email.xposedornot",
    name: "Breach exposure",
    category: "exposure",
    status: "error",
    summary: "Source unavailable",
    facts: [],
    signals: [],
    error: "Rate limited by upstream source — try again shortly",
    source: { name: "XposedOrNot", url: "https://xposedornot.com" },
    durationMs: 800,
};

const hibp: CheckResult = {
    id: "email.hibp",
    name: "Have I Been Pwned",
    category: "exposure",
    status: "skipped",
    summary: "Requires HIBP_API_KEY",
    facts: [],
    signals: [],
    source: { name: "Have I Been Pwned", url: "https://haveibeenpwned.com" },
    durationMs: 0,
};

const dns: CheckResult = {
    id: "domain.dns",
    name: "DNS & mail authentication",
    category: "infrastructure",
    status: "clean",
    summary: "Records look normal",
    facts: [{ label: "MX", value: "mx.example.test", mono: true }],
    signals: [],
    durationMs: 40,
};

const pivots: CheckResult = {
    id: "pivots",
    name: "Investigate further",
    category: "pivots",
    status: "info",
    summary: "3 specialist tools",
    facts: [],
    items: [
        { title: "Search this wording", subtitle: "Scam scripts are reused verbatim", href: "https://search.example.test/?q=urgent", tags: ["search"] },
        { title: "Report to the FTC (US)", href: "https://reportfraud.ftc.gov", tags: ["report"] },
        { title: "Report to Action Fraud (UK)", href: "https://www.actionfraud.police.uk", tags: ["report"] },
    ],
    signals: [],
    durationMs: 1,
};

/** Deliberately NOT in display order, so the UI's category ordering is actually exercised. */
export const messageChecks: CheckResult[] = [message, pivots, community, dns, profiles, breaches, lookalike, hibp];

/** Category order the results page must render (Search.tsx ORDER, skipped sources excluded). */
export const CATEGORY_ORDER = ["community", "reputation", "content", "identity", "exposure", "infrastructure", "pivots"] as const;

export function messageReport(overrides: Partial<LookupReport> = {}): LookupReport {
    return {
        target: messageTarget,
        verdict: {
            score: 98,
            level: "critical",
            label: "Dangerous",
            confidence: 0.86,
            topSignals: message.signals.filter((s) => s.kind === "risk"),
            trustSignals: message.signals.filter((s) => s.kind === "trust"),
        },
        checks: messageChecks,
        summary: {
            text: "Risk score 98/100 — dangerous for this message.",
            recommendations: ["Do not follow instructions in this message.", "Report the message to your provider."],
            generatedBy: "ai",
        },
        generatedAt: new Date().toISOString(),
        cached: false,
        durationMs: 3200,
        ...overrides,
    };
}

export function domainReport(domain = "example.com"): LookupReport {
    const target: Target = { type: "domain", input: domain, normalized: domain, host: domain };
    return {
        target,
        verdict: { score: 12, level: "safe", label: "No red flags", confidence: 1, topSignals: [], trustSignals: [] },
        checks: [{ ...dns }],
        summary: { text: "Nothing suspicious found.", recommendations: ["Stay alert."], generatedBy: "rules" },
        generatedAt: new Date().toISOString(),
        cached: false,
        durationMs: 900,
    };
}

export const stats: DashboardStats = { totalLookups: 12345, totalReports: 56, reportsLast24h: 7, knownScams: 6, topCategories: [] };

export const sources: { sources: SourceInfo[]; aiSummaries: boolean } = {
    aiSummaries: true,
    sources: [
        { id: "community", name: "Community reports", category: "community", appliesTo: ["email", "domain", "url", "ip", "phone", "text"], enabled: true, source: { name: "ScamShield community", url: "/sources" } },
        { id: "email.hibp", name: "Have I Been Pwned", category: "exposure", appliesTo: ["email"], enabled: false, reason: "Requires HIBP_API_KEY", source: { name: "Have I Been Pwned", url: "https://haveibeenpwned.com" } },
        { id: "domain.dns", name: "DNS & mail authentication", category: "infrastructure", appliesTo: ["email", "domain", "url"], enabled: true },
    ],
};
