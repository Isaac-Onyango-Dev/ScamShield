import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { AlertCircle, Check, Copy, Download, Flag, RefreshCw } from "lucide-react";
import { TYPE_LABELS } from "@shared/detect";
import { TARGET_TYPES, type CheckResult, type TargetType } from "@shared/types";
import { useLookupStream } from "@/lib/api";
import { SearchBox } from "@/components/SearchBox";
import { VerdictPanel } from "@/components/VerdictPanel";
import { CheckCard, PendingCard } from "@/components/CheckCard";
import { ReportDialog } from "@/components/ReportDialog";
import { CATEGORY_LABELS, timeAgo } from "@/lib/ui";

const ORDER = ["community", "reputation", "content", "identity", "exposure", "infrastructure", "pivots"];

export function SearchPage() {
    const params = new URLSearchParams(useSearch());
    const q = params.get("q");
    const typeParam = params.get("type");
    const type = TARGET_TYPES.includes(typeParam as TargetType) ? (typeParam as TargetType) : undefined;
    const { state, rerun } = useLookupStream(q, type);
    const [reportOpen, setReportOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const running = state.phase === "connecting" || state.phase === "streaming";
    const done = Object.keys(state.results).length;

    const sections = useMemo(() => {
        const groups = new Map<string, { id: string; name: string; result?: CheckResult }[]>();
        for (const p of state.planned) {
            const result = state.results[p.id];
            if (result?.status === "skipped") continue;
            const list = groups.get(p.category) ?? [];
            list.push({ ...p, result });
            groups.set(p.category, list);
        }
        return ORDER.filter((c) => groups.has(c)).map((c) => ({ category: c, checks: groups.get(c)! }));
    }, [state.planned, state.results]);

    const skipped = Object.values(state.results).filter((r) => r.status === "skipped");

    function exportJson() {
        if (!state.report) return;
        const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `scamshield-${state.report.target.type}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async function copyLink() {
        await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            <SearchBox initial={q ?? ""} size="md" busy={running} />

            {state.phase === "error" && (
                <div className="panel mt-6 flex items-start gap-3 border-rose-500/30 p-5 text-rose-200">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-semibold">Lookup failed</p>
                        <p className="text-sm text-rose-200/80">{state.error}</p>
                    </div>
                </div>
            )}

            {state.target && (
                <>
                    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="chip border-brand-400/30 text-brand-300">{TYPE_LABELS[state.target.type]}</span>
                                {state.report?.cached && <span className="chip">cached · {timeAgo(state.report.generatedAt)}</span>}
                                {state.report && !state.report.cached && <span className="chip tabular-nums">{(state.report.durationMs / 1000).toFixed(1)} s</span>}
                            </div>
                            <h1
                                className={
                                    state.target.type === "text"
                                        ? "mt-2 break-words text-base leading-relaxed text-white sm:text-lg"
                                        : "mt-2 break-all font-mono text-lg text-white sm:text-2xl"
                                }
                            >
                                {state.target.type === "text" ? `"${state.target.normalized.slice(0, 140)}${state.target.normalized.length > 140 ? "…" : ""}"` : state.target.normalized}
                            </h1>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            <button onClick={copyLink} className="btn-ghost" title="Copy link to this lookup">
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Share
                            </button>
                            <button onClick={exportJson} disabled={!state.report} className="btn-ghost" title="Download full report as JSON">
                                <Download className="h-4 w-4" /> JSON
                            </button>
                            <button onClick={rerun} disabled={running} className="btn-ghost" title="Bypass cache and re-query every source">
                                <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> Re-scan
                            </button>
                            <button onClick={() => setReportOpen(true)} className="btn border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20">
                                <Flag className="h-4 w-4" /> Report
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
                        <aside className="lg:sticky lg:top-20 lg:self-start">
                            <VerdictPanel report={state.report} progress={{ done, total: state.planned.length }} />
                        </aside>
                        <div className="min-w-0 space-y-8">
                            {sections.map((s) => (
                                <section key={s.category}>
                                    <div className="mb-3">
                                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{CATEGORY_LABELS[s.category].title}</h2>
                                        <p className="text-xs text-slate-500">{CATEGORY_LABELS[s.category].blurb}</p>
                                    </div>
                                    <div className="space-y-3">
                                        {s.checks.map((c) => (c.result ? <CheckCard key={c.id} result={c.result} /> : <PendingCard key={c.id} name={c.name} />))}
                                    </div>
                                </section>
                            ))}
                            {skipped.length > 0 && (
                                <p className="text-xs text-slate-500">
                                    Not run: {skipped.map((s) => `${s.name} (${s.summary})`).join(" · ")}
                                </p>
                            )}
                        </div>
                    </div>
                    <ReportDialog target={state.target} open={reportOpen} onClose={() => setReportOpen(false)} onReported={rerun} />
                </>
            )}

            {!q && <p className="mt-10 text-center text-slate-500">Enter something to investigate.</p>}
        </div>
    );
}
