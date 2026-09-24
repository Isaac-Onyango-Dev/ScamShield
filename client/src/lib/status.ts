import { AlertTriangle, Ban, CheckCircle2, Circle, CircleDashed, Info, OctagonAlert, Search, type LucideIcon } from "lucide-react";
import type { CheckResult, CheckStatus, RiskLevel, Severity, Signal } from "@shared/types";

/**
 * One accent plus three semantic tones (docs/REDESIGN_PLAN.md §3.1). Every status is also
 * written as a word and drawn with a distinct icon shape, so colour is never the only signal.
 */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export const TONE_TEXT: Record<Tone, string> = {
    neutral: "text-fg-secondary",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
};

export const TONE_TINT: Record<Tone, string> = {
    neutral: "bg-surface-2 text-fg-secondary",
    accent: "bg-accent-tint text-accent",
    success: "bg-success-tint text-success",
    warning: "bg-warning-tint text-warning",
    danger: "bg-danger-tint text-danger",
};

export interface Presentation {
    tone: Tone;
    label: string;
    icon: LucideIcon;
    /** Solid fill instead of a tint, used for the most severe level only. */
    solid?: boolean;
}

export const LEVELS: Record<RiskLevel, Presentation> = {
    safe: { tone: "success", label: "No red flags", icon: CheckCircle2 },
    low: { tone: "neutral", label: "Low risk", icon: Circle },
    medium: { tone: "warning", label: "Suspicious", icon: AlertTriangle },
    high: { tone: "danger", label: "High risk", icon: OctagonAlert },
    critical: { tone: "danger", label: "Dangerous", icon: OctagonAlert, solid: true },
};

export const SEVERITIES: Record<Severity, Presentation> = {
    info: { tone: "neutral", label: "Info", icon: Circle },
    low: { tone: "neutral", label: "Low", icon: Circle },
    medium: { tone: "warning", label: "Medium", icon: AlertTriangle },
    high: { tone: "danger", label: "High", icon: OctagonAlert },
    critical: { tone: "danger", label: "Critical", icon: OctagonAlert },
};

export const TRUST: Presentation = { tone: "success", label: "Trust", icon: CheckCircle2 };

export const STATUSES: Record<CheckStatus, Presentation> = {
    clean: { tone: "success", label: "Clean", icon: CheckCircle2 },
    found: { tone: "neutral", label: "Found", icon: Search },
    info: { tone: "neutral", label: "Info", icon: Info },
    warning: { tone: "warning", label: "Warning", icon: AlertTriangle },
    danger: { tone: "danger", label: "Alert", icon: OctagonAlert },
    error: { tone: "neutral", label: "Unavailable", icon: Ban },
    skipped: { tone: "neutral", label: "Not run", icon: CircleDashed },
};

/** Upstream 429s surface as `HttpError(429, "Rate limited by upstream source…")` (server/lib/http.ts). */
export function isRateLimited(result: Pick<CheckResult, "status" | "error">): boolean {
    return result.status === "error" && /rate.?limit/i.test(result.error ?? "");
}

export function statusPresentation(result: Pick<CheckResult, "status" | "error">): Presentation {
    return isRateLimited(result) ? { ...STATUSES.error, label: "Rate limited by source" } : STATUSES[result.status];
}

export function signalPresentation(signal: Signal): Presentation {
    return signal.kind === "trust" ? TRUST : SEVERITIES[signal.severity];
}

/** Findings filter groups (FindingsTable). */
export type FindingFilter = "all" | "flags" | "clean" | "unavailable";

export function matchesFilter(status: CheckStatus | undefined, filter: FindingFilter): boolean {
    if (filter === "all") return true;
    if (!status) return false;
    if (filter === "flags") return status === "warning" || status === "danger";
    if (filter === "clean") return status === "clean";
    return status === "error";
}
