import type { CheckResult, RiskLevel, Severity, Signal, Verdict } from "../../shared/types";

/**
 * Explainable scoring. Each risk signal is treated as independent evidence
 * with a probability-like weight; they combine as 1 - Π(1 - w). Trust signals
 * dampen the result, but can never pull a critical finding below "high".
 */
export const RISK_WEIGHTS: Record<Severity, number> = { info: 0, low: 0.08, medium: 0.2, high: 0.45, critical: 0.8 };
export const TRUST_WEIGHTS: Record<Severity, number> = { info: 0, low: 0.1, medium: 0.25, high: 0.6, critical: 0.85 };
const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function levelFor(score: number): RiskLevel {
    if (score >= 80) return "critical";
    if (score >= 60) return "high";
    if (score >= 40) return "medium";
    if (score >= 20) return "low";
    return "safe";
}

export const LEVEL_LABELS: Record<RiskLevel, string> = {
    safe: "No red flags found",
    low: "Low risk",
    medium: "Suspicious",
    high: "High risk",
    critical: "Dangerous",
};

function combine(weights: number[]): number {
    return 1 - weights.reduce((acc, w) => acc * (1 - w), 1);
}

function dedupe(signals: Signal[]): Signal[] {
    const seen = new Map<string, Signal>();
    for (const s of signals) {
        const prev = seen.get(s.id);
        if (!prev || SEVERITY_ORDER.indexOf(s.severity) < SEVERITY_ORDER.indexOf(prev.severity)) seen.set(s.id, s);
    }
    return [...seen.values()];
}

const bySeverity = (a: Signal, b: Signal) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);

export function computeVerdict(results: CheckResult[]): Verdict {
    const signals = dedupe(results.flatMap((r) => r.signals));
    const risk = signals.filter((s) => s.kind === "risk" && s.severity !== "info").sort(bySeverity);
    const trust = signals.filter((s) => s.kind === "trust" && s.severity !== "info").sort(bySeverity);

    const riskP = combine(risk.map((s) => RISK_WEIGHTS[s.severity]));
    const trustP = combine(trust.map((s) => TRUST_WEIGHTS[s.severity]));
    let score = riskP * (1 - 0.75 * trustP) * 100;

    // Hard floors: confirmed-malicious evidence must dominate reputation.
    if (risk.some((s) => s.severity === "critical")) score = Math.max(score, 80);
    else if (risk.filter((s) => s.severity === "high").length >= 2) score = Math.max(score, 60);

    score = Math.round(Math.min(100, Math.max(0, score)));

    const answered = results.filter((r) => r.status !== "skipped" && r.category !== "pivots");
    const succeeded = answered.filter((r) => r.status !== "error");
    const confidence = answered.length ? succeeded.length / answered.length : 0;
    const level = levelFor(score);

    return {
        score,
        level,
        label: LEVEL_LABELS[level],
        confidence: Math.round(confidence * 100) / 100,
        topSignals: risk.slice(0, 8),
        trustSignals: trust.slice(0, 6),
    };
}
