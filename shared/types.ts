/**
 * Shared contract between the lookup engine (server) and the UI (client).
 * Everything the API returns is described here.
 */

export const TARGET_TYPES = ["email", "domain", "url", "ip", "phone", "text"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const REPORT_CATEGORIES = [
    "phishing",
    "scam",
    "fraud",
    "spam",
    "malware",
    "impersonation",
    "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

/**
 * - clean:   the source was queried and found nothing bad
 * - found:   the source returned footprint data (neutral, e.g. a public profile)
 * - warning / danger: the source returned something risky
 * - info:    purely informational
 * - error:   the source failed (timeout, rate limit, network)
 * - skipped: not applicable or not configured (e.g. missing API key)
 */
export type CheckStatus = "clean" | "found" | "info" | "warning" | "danger" | "error" | "skipped";

export type CheckCategory =
    | "identity"
    | "infrastructure"
    | "exposure"
    | "reputation"
    | "content"
    | "community"
    | "pivots";

/** A single scored piece of evidence. `risk` raises the score, `trust` lowers it. */
export interface Signal {
    id: string;
    label: string;
    kind: "risk" | "trust";
    severity: Severity;
}

export interface Fact {
    label: string;
    value: string;
    href?: string;
    mono?: boolean;
}

export interface Item {
    title: string;
    subtitle?: string;
    href?: string;
    tags?: string[];
    date?: string;
    image?: string;
}

export interface CheckResult {
    id: string;
    name: string;
    category: CheckCategory;
    status: CheckStatus;
    summary: string;
    facts: Fact[];
    items?: Item[];
    signals: Signal[];
    source?: { name: string; url: string };
    durationMs: number;
    error?: string;
}

export interface Target {
    type: TargetType;
    input: string;
    /** Canonical form used for caching, reports and lookups. */
    normalized: string;
    /** Host portion for email/url/domain targets. */
    host?: string;
}

export interface Verdict {
    score: number; // 0-100
    level: RiskLevel;
    label: string;
    /** Share of applicable sources that answered successfully (0-1). */
    confidence: number;
    topSignals: Signal[];
    trustSignals: Signal[];
}

export interface LookupSummary {
    text: string;
    recommendations: string[];
    generatedBy: "ai" | "rules";
}

export interface LookupReport {
    target: Target;
    verdict: Verdict;
    checks: CheckResult[];
    summary: LookupSummary;
    generatedAt: string;
    cached: boolean;
    durationMs: number;
}

/** Server-sent events emitted by GET /api/lookup/stream */
export type StreamEvent =
    | { type: "start"; target: Target; checks: { id: string; name: string; category: CheckCategory }[] }
    | { type: "check"; result: CheckResult }
    | { type: "done"; report: LookupReport }
    | { type: "error"; message: string };

export interface SourceInfo {
    id: string;
    name: string;
    category: CheckCategory;
    appliesTo: TargetType[];
    enabled: boolean;
    reason?: string;
    source?: { name: string; url: string };
}

export interface DashboardStats {
    totalLookups: number;
    totalReports: number;
    reportsLast24h: number;
    knownScams: number;
    topCategories: { category: string; count: number }[];
}
