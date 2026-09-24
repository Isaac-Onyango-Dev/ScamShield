import { Sparkles, ShieldAlert, ShieldCheck } from "lucide-react";
import type { LookupReport, Signal } from "@shared/types";
import { RiskGauge } from "./RiskGauge";
import { cn, LEVEL_STYLES, SEVERITY_DOT } from "@/lib/ui";

function SignalList({ signals, trust }: { signals: Signal[]; trust?: boolean }) {
    return (
        <ul className="space-y-2">
            {signals.map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm leading-snug">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", trust ? "bg-emerald-400" : SEVERITY_DOT[s.severity])} />
                    <span className="text-slate-200">{s.label}</span>
                </li>
            ))}
        </ul>
    );
}

interface Props {
    report?: LookupReport;
    progress: { done: number; total: number };
}

export function VerdictPanel({ report, progress }: Props) {
    const verdict = report?.verdict;
    const level = verdict?.level ?? "safe";
    const style = LEVEL_STYLES[level];
    return (
        <section className={cn("panel p-6", verdict && `ring-1 ${style.ring}`)} aria-live="polite">
            <RiskGauge score={verdict ? verdict.score : null} level={level} />
            <div className="mt-3 text-center">
                {verdict ? (
                    <>
                        <p className={cn("text-xl font-bold", style.text)}>{verdict.label}</p>
                        <p className="mt-1 text-xs text-slate-500">
                            Confidence {Math.round(verdict.confidence * 100)}% · {progress.total} sources
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-lg font-semibold text-slate-300">Investigating…</p>
                        <p className="mt-1 text-xs tabular-nums text-slate-500">
                            {progress.done} / {progress.total} sources answered
                        </p>
                    </>
                )}
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                    className="h-full rounded-full bg-brand-400 transition-all duration-500"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
            </div>

            {report && (
                <div className="mt-6 space-y-6">
                    <div>
                        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {report.summary.generatedBy === "ai" && <Sparkles className="h-3.5 w-3.5 text-brand-300" />}
                            Assessment
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-300">{report.summary.text}</p>
                    </div>
                    {verdict!.topSignals.length > 0 && (
                        <div>
                            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <ShieldAlert className="h-3.5 w-3.5" /> Red flags
                            </h3>
                            <SignalList signals={verdict!.topSignals} />
                        </div>
                    )}
                    {verdict!.trustSignals.length > 0 && (
                        <div>
                            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <ShieldCheck className="h-3.5 w-3.5" /> Trust signals
                            </h3>
                            <SignalList signals={verdict!.trustSignals} trust />
                        </div>
                    )}
                    <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">What to do</h3>
                        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300 marker:text-slate-500">
                            {report.summary.recommendations.map((r) => (
                                <li key={r}>{r}</li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}
        </section>
    );
}
