import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { TYPE_LABELS } from "@shared/detect";
import { fetchSources } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/ui";

export function SourcesPage() {
    const { data, isLoading, error } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
    return (
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">Intelligence sources</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
                Every lookup is answered by these modules. Optional sources activate when the operator configures an API key.
                ScamShield only reads public data — it never sends email, calls numbers, or logs into accounts.
            </p>
            {data && (
                <p className="mt-2 text-sm text-slate-500">
                    AI-written summaries: {data.aiSummaries ? "enabled" : "disabled (rule-based summaries in use)"}
                </p>
            )}
            {isLoading && <p className="mt-8 text-slate-500">Loading…</p>}
            {error && <p className="mt-8 text-rose-300">{(error as Error).message}</p>}
            <div className="panel mt-8 divide-y divide-white/[0.06] overflow-hidden">
                {data?.sources.map((s) => (
                    <div key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            {s.enabled ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" /> : <CircleDashed className="mt-0.5 h-5 w-5 text-slate-500" />}
                            <div>
                                <p className="font-medium text-white">{s.name}</p>
                                <p className="text-xs text-slate-500">
                                    {CATEGORY_LABELS[s.category]?.title} ·{" "}
                                    {s.source ? (
                                        s.source.url.startsWith("/") ? s.source.name : (
                                            <a href={s.source.url} target="_blank" rel="noreferrer" className="hover:text-slate-300">
                                                {s.source.name}
                                            </a>
                                        )
                                    ) : (
                                        "built-in analysis"
                                    )}
                                    {!s.enabled && s.reason && <span className="text-amber-300/80"> · {s.reason}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-8 sm:pl-0">
                            {s.appliesTo.map((t) => (
                                <span key={t} className="chip">
                                    {TYPE_LABELS[t]}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
