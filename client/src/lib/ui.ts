import type { CheckStatus, RiskLevel, Severity } from "@shared/types";

export { clsx as cn } from "clsx";

export const LEVEL_STYLES: Record<RiskLevel, { text: string; ring: string; bg: string; stroke: string; label: string }> = {
    safe: { text: "text-emerald-300", ring: "ring-emerald-400/30", bg: "bg-emerald-400/10", stroke: "#34d399", label: "No red flags" },
    low: { text: "text-sky-300", ring: "ring-sky-400/30", bg: "bg-sky-400/10", stroke: "#38bdf8", label: "Low risk" },
    medium: { text: "text-amber-300", ring: "ring-amber-400/30", bg: "bg-amber-400/10", stroke: "#fbbf24", label: "Suspicious" },
    high: { text: "text-orange-300", ring: "ring-orange-400/30", bg: "bg-orange-400/10", stroke: "#fb923c", label: "High risk" },
    critical: { text: "text-rose-300", ring: "ring-rose-400/40", bg: "bg-rose-500/10", stroke: "#fb7185", label: "Dangerous" },
};

export const SEVERITY_DOT: Record<Severity, string> = {
    info: "bg-slate-500",
    low: "bg-sky-400",
    medium: "bg-amber-400",
    high: "bg-orange-400",
    critical: "bg-rose-500",
};

export const STATUS_STYLES: Record<CheckStatus, { label: string; cls: string }> = {
    clean: { label: "Clean", cls: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
    found: { label: "Found", cls: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20" },
    info: { label: "Info", cls: "text-slate-300 bg-white/5 border-white/10" },
    warning: { label: "Warning", cls: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
    danger: { label: "Alert", cls: "text-rose-300 bg-rose-500/10 border-rose-500/25" },
    error: { label: "Unavailable", cls: "text-slate-400 bg-white/5 border-white/10" },
    skipped: { label: "Not run", cls: "text-slate-500 bg-white/[0.02] border-white/5" },
};

export const CATEGORY_LABELS: Record<string, { title: string; blurb: string }> = {
    community: { title: "Community intelligence", blurb: "What other people have reported" },
    reputation: { title: "Threat reputation", blurb: "Blocklists, threat feeds and impersonation analysis" },
    content: { title: "Content analysis", blurb: "What the link or message itself reveals" },
    identity: { title: "Identity & footprint", blurb: "Public profiles and ownership signals" },
    exposure: { title: "Breach & leak exposure", blurb: "Data breaches and malware logs" },
    infrastructure: { title: "Infrastructure", blurb: "DNS, registration, certificates and networks" },
    pivots: { title: "Investigate further", blurb: "Deep links to specialist tools" },
};

export function timeAgo(iso: string): string {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
}
