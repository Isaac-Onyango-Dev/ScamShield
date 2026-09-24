import type { CheckStatus, Severity, Signal, Target } from "../../shared/types";
import { hostInfo, isFreeProvider } from "../lib/domain";
import { isIP } from "../../shared/detect";

export const risk = (id: string, severity: Severity, label: string): Signal => ({ id, kind: "risk", severity, label });
export const trust = (id: string, severity: Severity, label: string): Signal => ({ id, kind: "trust", severity, label });

/** Derives a card status from the strongest risk signal. */
export function statusFromSignals(signals: Signal[], fallback: CheckStatus = "clean"): CheckStatus {
    const r = signals.filter((s) => s.kind === "risk");
    if (r.some((s) => s.severity === "critical" || s.severity === "high")) return "danger";
    if (r.some((s) => s.severity === "medium" || s.severity === "low")) return "warning";
    return fallback;
}

/** The hostname that infrastructure checks should examine for this target. */
export function targetHost(target: Target): string | undefined {
    return target.host ?? (target.type === "domain" ? target.normalized : undefined);
}

export function hasDomainHost(target: Target): boolean {
    const host = targetHost(target);
    return !!host && !isIP(host) && !!hostInfo(host).registrable;
}

/** Email targets on big webmail providers don't need domain-level investigation. */
export function hasCustomDomain(target: Target): boolean {
    if (!hasDomainHost(target)) return false;
    if (target.type !== "email") return true;
    return !isFreeProvider(target.host!);
}

export function daysBetween(a: Date, b: Date): number {
    return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function formatDate(d: string | Date | null | undefined): string {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return Number.isNaN(date.getTime()) ? String(d) : date.toISOString().slice(0, 10);
}

export function humanAge(days: number): string {
    if (days < 1) return "less than a day";
    if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
    if (days < 730) return `${Math.round(days / 30)} months`;
    return `${(days / 365).toFixed(1)} years`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
    return `${n.toLocaleString("en-US")} ${n === 1 ? word : pluralWord}`;
}
